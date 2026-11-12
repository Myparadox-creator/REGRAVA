"""
Review Deduplication Service for REGRAVA.
Prevents duplicate GitHub reviews and redundant inline comments on identical
(repo, PR, head_sha, analyzer_version, fingerprints) combinations.
"""

from __future__ import annotations

import hashlib
from typing import Any, Dict, List, Optional, Set, Tuple
from app.config import settings
from app.db.session_db import db


class ReviewDeduplicationService:
    """Checks for prior reviews and filters out previously published findings."""

    @staticmethod
    def build_dedup_key(
        repo_identifier: str,
        pr_number: int,
        head_sha: str,
        analyzer_version: str,
        fingerprints: List[str],
    ) -> str:
        fp_part = ",".join(sorted(set(fingerprints)))
        raw = f"{repo_identifier.lower()}|{pr_number}|{head_sha}|{analyzer_version}|{fp_part}"
        return hashlib.sha256(raw.encode("utf-8")).hexdigest()

    def check_duplicate_review(
        self,
        repo_full_name: str,
        repo_id: Optional[str],
        pr_number: int,
        head_sha: str,
        fingerprints: List[str],
        force_re_review: bool = False,
    ) -> Dict[str, Any]:
        """
        Determine whether a commit has already been reviewed and what fingerprints
        were already published.

        Returns dict:
          - is_duplicate: bool (True -> already reviewed with no new findings)
          - existing_review: Optional[Dict]
          - already_published_fingerprints: Set[str]
          - has_prior_review_on_commit: bool
          - dedup_key: str
        """
        repo_ident = str(repo_id or repo_full_name)
        dedup_key = self.build_dedup_key(
            repo_ident, pr_number, head_sha, settings.ANALYZER_VERSION, fingerprints
        )

        existing_for_commit = db.find_published_reviews_for_pr(
            repo_full_name=repo_full_name,
            pr_number=pr_number,
            head_sha=head_sha,
        )

        # Only consider reviews that were actually published (or dry-run recorded if same commit)
        valid_prior = [
            r for r in existing_for_commit
            if r.get("publication_status") == "published"
        ]

        already_published_fps: Set[str] = set()
        for r in valid_prior:
            already_published_fps.update(r.get("published_fingerprints", []))

        # Check exact dedup_key match on published reviews
        exact_match = next(
            (r for r in valid_prior if r.get("dedup_key") == dedup_key),
            None,
        )

        if exact_match and not force_re_review:
            return {
                "is_duplicate": True,
                "existing_review": exact_match,
                "already_published_fingerprints": already_published_fps,
                "has_prior_review_on_commit": True,
                "dedup_key": dedup_key,
            }

        # Even if force_re_review=True, if zero new fingerprints exist on the same commit,
        # avoid posting identical comments again.
        new_fps = set(fingerprints) - already_published_fps
        if valid_prior and not new_fps:
            return {
                "is_duplicate": True,
                "existing_review": valid_prior[0],
                "already_published_fingerprints": already_published_fps,
                "has_prior_review_on_commit": True,
                "dedup_key": dedup_key,
            }

        return {
            "is_duplicate": False,
            "existing_review": valid_prior[0] if valid_prior else None,
            "already_published_fingerprints": already_published_fps,
            "has_prior_review_on_commit": bool(valid_prior),
            "dedup_key": dedup_key,
        }


review_deduplication_service = ReviewDeduplicationService()
