"""
Review Finding Lifecycle Service for REGRAVA.
Tracks findings across multiple PR commits, records GitHub review/comment IDs,
and conservatively updates resolution statuses only when backed by evidence.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Set
from app.db.session_db import db
from app.services.review_formatter import compute_finding_fingerprint


VALID_LIFECYCLE_STATUSES = {
    "Open",
    "Fix Attempted",
    "Verified Fixed",
    "Still Present",
    "Dismissed with Reason",
    "Accepted with Reason",
    "Verification Inconclusive",
}


class ReviewLifecycleService:
    """Tracks findings across commits and maps GitHub review publication metadata."""

    def reconcile_findings_for_commit(
        self,
        repo_full_name: str,
        repo_id: Optional[str],
        pr_number: int,
        head_sha: str,
        findings: List[Dict[str, Any]],
        changed_file_paths: Set[str],
        review_record: Optional[Dict[str, Any]] = None,
        published_comments_map: Optional[Dict[str, str]] = None,
    ) -> List[Dict[str, Any]]:
        """
        Compare findings discovered on `head_sha` against historical findings on this PR:
        - Existing finding still present -> 'Still Present' (unless explicitly Dismissed/Accepted).
        - New finding -> 'Open'.
        - Previously active finding absent in latest scan ->
          * 'Verified Fixed' ONLY when file was modified AND test/AST verification supports remediation.
          * 'Fix Attempted' when file was modified and pattern vanished, without dedicated test verification.
          * 'Verification Inconclusive' when file wasn't in analyzed diff or evidence is insufficient.
        """
        now = datetime.now(timezone.utc).isoformat()
        existing_records = db.list_finding_lifecycle_for_pr(repo_full_name, pr_number)
        existing_by_fp: Dict[str, Dict[str, Any]] = {r["fingerprint"]: r for r in existing_records}

        norm_changed = {p.replace("\\", "/") for p in changed_file_paths}
        comments_map = published_comments_map or {}
        gh_review_id = review_record.get("github_review_id") if review_record else None
        is_published = bool(review_record and review_record.get("publication_status") == "published")

        seen_fps: Set[str] = set()
        results: List[Dict[str, Any]] = []

        for f in findings:
            fp = f.get("fingerprint") or compute_finding_fingerprint(f)
            f["fingerprint"] = fp
            seen_fps.add(fp)

            cf = f.get("changed_file") or {}
            fpath = (cf.get("path") or "").replace("\\", "/") or None
            line_no = cf.get("line")
            comment_id = comments_map.get(fp)
            prev = existing_by_fp.get(fp)

            if prev:
                prev_status = prev["current_status"]
                if prev_status in ("Dismissed with Reason", "Accepted with Reason"):
                    next_status = prev_status
                elif prev.get("original_head_sha") == head_sha:
                    next_status = prev_status
                else:
                    next_status = "Still Present"

                rec = db.upsert_finding_lifecycle({
                    "id": prev["id"],
                    "finding_id": f.get("id", prev["finding_id"]),
                    "fingerprint": fp,
                    "repo_full_name": repo_full_name,
                    "repo_id": repo_id or prev.get("repo_id"),
                    "pr_number": pr_number,
                    "original_head_sha": prev["original_head_sha"],
                    "current_head_sha": head_sha,
                    "category": str(f.get("category", prev["category"])),
                    "severity": str(f.get("severity", prev["severity"])),
                    "confidence": str(f.get("confidence", prev["confidence"])),
                    "title": str(f.get("title", prev["title"])),
                    "file_path": fpath,
                    "line_number": line_no,
                    "evidence": f.get("evidence", []),
                    "published_review_id": gh_review_id or prev.get("published_review_id"),
                    "published_comment_id": comment_id or prev.get("published_comment_id"),
                    "published_to_github": is_published or prev.get("published_to_github", False),
                    "previous_status": prev_status,
                    "current_status": next_status,
                    "first_seen_at": prev["first_seen_at"],
                    "last_seen_at": now,
                })
                results.append(rec)
            else:
                rec_id = f"fl-{uuid.uuid4().hex[:12]}"
                rec = db.upsert_finding_lifecycle({
                    "id": rec_id,
                    "finding_id": str(f.get("id", "RS-000")),
                    "fingerprint": fp,
                    "repo_full_name": repo_full_name,
                    "repo_id": repo_id,
                    "pr_number": pr_number,
                    "original_head_sha": head_sha,
                    "current_head_sha": head_sha,
                    "category": str(f.get("category", "security")),
                    "severity": str(f.get("severity", "medium")),
                    "confidence": str(f.get("confidence", "medium")),
                    "title": str(f.get("title", "Finding")),
                    "file_path": fpath,
                    "line_number": line_no,
                    "evidence": f.get("evidence", []),
                    "published_review_id": gh_review_id if is_published else None,
                    "published_comment_id": comment_id if is_published else None,
                    "published_to_github": is_published,
                    "previous_status": None,
                    "current_status": "Open",
                    "first_seen_at": now,
                    "last_seen_at": now,
                })
                results.append(rec)

        # Reassess previously active findings that were NOT detected in `head_sha`
        # Do NOT blindly mark Verified Fixed without evidence!
        has_test_files = any("test_" in p or "_test.py" in p or ".test." in p or "/tests/" in p for p in norm_changed)
        for fp, prev in existing_by_fp.items():
            if fp in seen_fps:
                continue
            prev_status = prev["current_status"]
            if prev_status in ("Dismissed with Reason", "Accepted with Reason", "Verified Fixed"):
                results.append(prev)
                continue

            prev_file = (prev.get("file_path") or "").replace("\\", "/")
            file_was_reanalyzed = bool(prev_file and prev_file in norm_changed)

            if file_was_reanalyzed and has_test_files:
                next_status = "Verified Fixed"
                verif_ev = (
                    f"Target file '{prev_file}' was modified in commit {head_sha[:7]}, the flagged pattern "
                    f"was no longer detected by AST scan, and modified/present test files were observed."
                )
            elif file_was_reanalyzed:
                next_status = "Fix Attempted"
                verif_ev = (
                    f"Target file '{prev_file}' was modified in commit {head_sha[:7]} and the pattern is no longer flagged; "
                    f"awaiting test confirmation to mark Verified Fixed."
                )
            else:
                next_status = "Verification Inconclusive"
                verif_ev = (
                    f"Finding was absent in commit {head_sha[:7]}, but '{prev_file or 'target file'}' was not modified "
                    f"in the scanned PR delta with sufficient verification evidence."
                )

            updated = db.update_finding_lifecycle_status(
                record_id=prev["id"],
                new_status=next_status,
                verification_evidence=verif_ev,
            )
            if updated:
                results.append(updated)

        return results


review_lifecycle_service = ReviewLifecycleService()
