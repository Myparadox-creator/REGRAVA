"""
GitHub Pull Request Review Publisher for REGRAVA.
Publishes PR reviews strictly under the REGRAVA GitHub App identity using
`POST /repos/{owner}/{repo}/pulls/{pull_number}/reviews` with event='COMMENT'.
Handles stale-commit cancellation, 422 inline fallback, safe failure preservation,
retry recovery, and local dry-run previews.
"""

from __future__ import annotations

import logging
import uuid
from typing import Any, Dict, List, Optional
from app.config import settings
from app.db.session_db import db
from app.services.github_app_service import GitHubAppError, github_app_auth
from app.services.pull_request_diff_service import pr_diff_service

logger = logging.getLogger(__name__)


class StaleAnalysisError(Exception):
    """Raised when the PR head commit changed while analysis was in progress."""

    def __init__(self, analyzed_sha: str, latest_sha: str):
        super().__init__(
            f"PR head updated during analysis (analyzed={analyzed_sha[:7]}, latest={latest_sha[:7]})."
        )
        self.analyzed_sha = analyzed_sha
        self.latest_sha = latest_sha


class ReviewPublisher:
    """Publishes formatted REGRAVA reviews to GitHub via the GitHub App installation."""

    GITHUB_API_BASE = "https://api.github.com"

    def _build_api_comments(self, comments: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        api_comments: List[Dict[str, Any]] = []
        for c in comments:
            api_comments.append({
                "path": c["path"],
                "line": int(c["line"]),
                "side": c.get("side", "RIGHT"),
                "body": c["body"],
            })
        return api_comments

    async def publish_review(
        self,
        repo_full_name: str,
        repo_id: Optional[str],
        pr_number: int,
        head_sha: str,
        analysis_id: str,
        dedup_key: str,
        review_payload: Dict[str, Any],
        installation_id: Optional[str] = None,
        mode: str = "manual",
        triggered_by: Optional[str] = None,
        dry_run: bool = False,
        verify_latest_sha: bool = True,
    ) -> Dict[str, Any]:
        """
        Publish a GitHub Pull Request review (or persist a dry-run / failed record for retry).
        Never claims 'published' unless GitHub returns HTTP 200/201 with a review ID.
        """
        owner, repo = repo_full_name.split("/", 1)
        review_record_id = f"rev-{uuid.uuid4().hex[:12]}"

        inline_comments = review_payload.get("comments", [])
        summary_body = review_payload.get("body", "")
        published_fps = review_payload.get("published_fingerprints", [])

        # Determine if dry-run must be used (demo mode, explicit dry_run, or App credentials missing)
        use_dry_run = dry_run or not github_app_auth.is_configured() or not installation_id

        if use_dry_run:
            reason = (
                "Dry-run requested or running in demo sandbox."
                if dry_run or not installation_id
                else "GitHub App credentials (GITHUB_APP_ID / private key) not configured; generated exact review payload in dry-run mode."
            )
            record = db.save_github_review(
                review_record_id=review_record_id,
                repo_full_name=repo_full_name,
                repo_id=repo_id,
                pr_number=pr_number,
                head_sha=head_sha,
                analyzer_version=settings.ANALYZER_VERSION,
                dedup_key=dedup_key,
                analysis_id=analysis_id,
                github_review_id=None,
                github_review_url=None,
                summary_body=summary_body,
                inline_comments=inline_comments,
                published_fingerprints=published_fps,
                publication_status="dry_run",
                error_detail=reason,
                mode=mode,
                triggered_by=triggered_by,
            )
            record["dry_run_payload"] = {
                "endpoint": f"POST /repos/{owner}/{repo}/pulls/{pr_number}/reviews",
                "commit_id": head_sha,
                "event": "COMMENT",
                "body": summary_body,
                "comments": self._build_api_comments(inline_comments),
            }
            return record

        # Verify PR head SHA hasn't changed while analysis was executing
        if verify_latest_sha:
            latest_sha = await pr_diff_service.get_latest_pr_head_sha(
                owner=owner,
                repo=repo,
                pr_number=pr_number,
                installation_id=installation_id,
            )
            if latest_sha and latest_sha != head_sha:
                db.save_github_review(
                    review_record_id=review_record_id,
                    repo_full_name=repo_full_name,
                    repo_id=repo_id,
                    pr_number=pr_number,
                    head_sha=head_sha,
                    analyzer_version=settings.ANALYZER_VERSION,
                    dedup_key=dedup_key,
                    analysis_id=analysis_id,
                    summary_body=summary_body,
                    inline_comments=inline_comments,
                    published_fingerprints=[],
                    publication_status="stale_discarded",
                    error_detail=f"Discarded stale analysis for {head_sha[:7]}; latest PR head is {latest_sha[:7]}.",
                    mode=mode,
                    triggered_by=triggered_by,
                )
                raise StaleAnalysisError(head_sha, latest_sha)

        return await self._execute_github_publish(
            review_record_id=review_record_id,
            installation_id=installation_id,
            repo_full_name=repo_full_name,
            repo_id=repo_id,
            pr_number=pr_number,
            head_sha=head_sha,
            analysis_id=analysis_id,
            dedup_key=dedup_key,
            summary_body=summary_body,
            inline_comments=inline_comments,
            published_fps=published_fps,
            mode=mode,
            triggered_by=triggered_by,
        )

    async def retry_publish_review(
        self,
        review_record_id: str,
        installation_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Safely retry publishing a previously failed review record."""
        existing = db.get_github_review(review_record_id)
        if not existing:
            raise FileNotFoundError(f"Review record '{review_record_id}' not found.")
        if existing.get("publication_status") == "published":
            return existing

        repo_full_name = existing["repo_full_name"]
        owner, repo = repo_full_name.split("/", 1)
        inst_id = installation_id
        if not inst_id and github_app_auth.is_configured():
            inst = await github_app_auth.get_installation_for_repo(owner, repo)
            inst_id = str(inst["installation_id"])

        if not inst_id or not github_app_auth.is_configured():
            raise GitHubAppError(
                "Cannot retry publication: GitHub App credentials or installation unavailable.",
                status_code=503,
            )

        # Ensure head SHA is still current before retrying
        latest_sha = await pr_diff_service.get_latest_pr_head_sha(
            owner=owner,
            repo=repo,
            pr_number=existing["pr_number"],
            installation_id=inst_id,
        )
        if latest_sha and latest_sha != existing["head_sha"]:
            raise StaleAnalysisError(existing["head_sha"], latest_sha)

        return await self._execute_github_publish(
            review_record_id=review_record_id,
            installation_id=inst_id,
            repo_full_name=repo_full_name,
            repo_id=existing.get("repo_id"),
            pr_number=existing["pr_number"],
            head_sha=existing["head_sha"],
            analysis_id=existing.get("analysis_id"),
            dedup_key=existing["dedup_key"],
            summary_body=existing["summary_body"],
            inline_comments=existing.get("inline_comments", []),
            published_fps=existing.get("published_fingerprints", []),
            mode=existing.get("mode", "manual"),
            triggered_by=existing.get("triggered_by"),
        )

    async def _execute_github_publish(
        self,
        review_record_id: str,
        installation_id: str,
        repo_full_name: str,
        repo_id: Optional[str],
        pr_number: int,
        head_sha: str,
        analysis_id: Optional[str],
        dedup_key: str,
        summary_body: str,
        inline_comments: List[Dict[str, Any]],
        published_fps: List[str],
        mode: str,
        triggered_by: Optional[str],
    ) -> Dict[str, Any]:
        url = f"{self.GITHUB_API_BASE}/repos/{repo_full_name}/pulls/{pr_number}/reviews"
        payload: Dict[str, Any] = {
            "commit_id": head_sha,
            "body": summary_body,
            "event": "COMMENT",
        }
        api_comments = self._build_api_comments(inline_comments)
        if api_comments:
            payload["comments"] = api_comments

        try:
            res = await github_app_auth.request_with_installation(
                installation_id, "POST", url, json_body=payload
            )

            # Graceful 422 fallback: if inline comment diff lines failed GitHub validation,
            # fold those comments into the summary review and submit cleanly without inline comments.
            if res.status_code == 422 and api_comments:
                logger.warning(
                    "GitHub returned 422 for inline comments on %s#%s; folding inline comments into summary.",
                    repo_full_name,
                    pr_number,
                )
                fallback_notes = ["", "### Detailed Findings (Inline Position Fallback)", ""]
                for c in inline_comments:
                    fallback_notes.append(f"**Location:** `{c['path']}:{c['line']}`\n\n{c['body']}\n")
                fallback_body = summary_body + "\n" + "\n".join(fallback_notes)
                fallback_payload = {
                    "commit_id": head_sha,
                    "body": fallback_body,
                    "event": "COMMENT",
                }
                res = await github_app_auth.request_with_installation(
                    installation_id, "POST", url, json_body=fallback_payload
                )
                if res.status_code in (200, 201):
                    summary_body = fallback_body
                    inline_comments = []

            if res.status_code in (200, 201):
                gh_data = res.json()
                gh_review_id = str(gh_data.get("id", ""))
                gh_review_url = gh_data.get("html_url") or f"https://github.com/{repo_full_name}/pull/{pr_number}#pullrequestreview-{gh_review_id}"

                # Fetch posted inline comment IDs so lifecycle records track exact GitHub comment IDs
                if inline_comments and gh_review_id:
                    try:
                        c_res = await github_app_auth.request_with_installation(
                            installation_id,
                            "GET",
                            f"{self.GITHUB_API_BASE}/repos/{repo_full_name}/pulls/{pr_number}/reviews/{gh_review_id}/comments",
                        )
                        if c_res.status_code == 200:
                            posted_comments = c_res.json()
                            for c_meta in inline_comments:
                                match = next(
                                    (
                                        pc for pc in posted_comments
                                        if pc.get("path") == c_meta["path"] and pc.get("line") == c_meta["line"]
                                    ),
                                    None,
                                )
                                if match:
                                    c_meta["github_comment_id"] = str(match["id"])
                                    c_meta["html_url"] = match.get("html_url")
                    except Exception:
                        pass

                return db.save_github_review(
                    review_record_id=review_record_id,
                    repo_full_name=repo_full_name,
                    repo_id=repo_id,
                    pr_number=pr_number,
                    head_sha=head_sha,
                    analyzer_version=settings.ANALYZER_VERSION,
                    dedup_key=dedup_key,
                    analysis_id=analysis_id,
                    github_review_id=gh_review_id,
                    github_review_url=gh_review_url,
                    summary_body=summary_body,
                    inline_comments=inline_comments,
                    published_fingerprints=published_fps,
                    publication_status="published",
                    error_detail=None,
                    mode=mode,
                    triggered_by=triggered_by,
                )

            # Error handling based on HTTP status
            if res.status_code == 403:
                err_msg = "GitHub returned 403 Forbidden: verify REGRAVA App has 'Pull requests: Read and write' permission."
            elif res.status_code == 404:
                err_msg = f"GitHub returned 404 Not Found: PR #{pr_number} or repository '{repo_full_name}' is unavailable to this installation."
            elif res.status_code == 422:
                err_msg = f"GitHub returned 422 Validation Error when submitting review for commit {head_sha[:7]}."
            elif res.status_code == 429:
                err_msg = "GitHub API rate limit exceeded. Completed analysis preserved; retry shortly."
            else:
                err_msg = f"GitHub review publication failed with HTTP {res.status_code}."

            db.save_github_review(
                review_record_id=review_record_id,
                repo_full_name=repo_full_name,
                repo_id=repo_id,
                pr_number=pr_number,
                head_sha=head_sha,
                analyzer_version=settings.ANALYZER_VERSION,
                dedup_key=dedup_key,
                analysis_id=analysis_id,
                summary_body=summary_body,
                inline_comments=inline_comments,
                published_fingerprints=published_fps,
                publication_status="failed",
                error_detail=err_msg,
                mode=mode,
                triggered_by=triggered_by,
            )
            raise GitHubAppError(err_msg, status_code=res.status_code, recoverable=True)

        except GitHubAppError:
            raise
        except Exception as exc:
            err_msg = f"Network or unexpected error publishing review to GitHub: {type(exc).__name__}"
            db.save_github_review(
                review_record_id=review_record_id,
                repo_full_name=repo_full_name,
                repo_id=repo_id,
                pr_number=pr_number,
                head_sha=head_sha,
                analyzer_version=settings.ANALYZER_VERSION,
                dedup_key=dedup_key,
                analysis_id=analysis_id,
                summary_body=summary_body,
                inline_comments=inline_comments,
                published_fingerprints=published_fps,
                publication_status="failed",
                error_detail=err_msg,
                mode=mode,
                triggered_by=triggered_by,
            )
            raise GitHubAppError(err_msg, status_code=502, recoverable=True) from exc


review_publisher = ReviewPublisher()
