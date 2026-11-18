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
import httpx
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

    async def _dispatch_github_request(
        self,
        auth_mode: str,
        installation_id: Optional[str],
        token: Optional[str],
        method: str,
        url: str,
        json_body: Optional[Dict[str, Any]] = None,
        extra_headers: Optional[Dict[str, str]] = None,
    ) -> httpx.Response:
        """Execute authenticated GitHub REST API request via App installation or user OAuth token."""
        if auth_mode == "app":
            return await github_app_auth.request_with_installation(
                installation_id, method, url, json_body=json_body, extra_headers=extra_headers
            )

        headers = {
            "Authorization": f"Bearer {token}",
            "Accept": "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
        }
        if extra_headers:
            headers.update(extra_headers)

        async with httpx.AsyncClient(timeout=20.0) as client:
            return await client.request(method, url, json=json_body, headers=headers)

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
        user_token: Optional[str] = None,
        mode: str = "manual",
        triggered_by: Optional[str] = None,
        dry_run: bool = False,
        verify_latest_sha: bool = True,
    ) -> Dict[str, Any]:
        """
        Publish a GitHub Pull Request review (or persist a dry-run / failed record for retry).
        Supports GitHub App installation credentials or authorized user OAuth token.
        Never claims 'published' unless GitHub returns HTTP 200/201 with a review ID.
        """
        owner, repo = repo_full_name.split("/", 1)
        review_record_id = f"rev-{uuid.uuid4().hex[:12]}"

        inline_comments = review_payload.get("comments", [])
        review_body = review_payload.get("body", "")
        top_summary = review_payload.get("summary_body") or review_payload.get("top_summary") or review_body
        published_fps = review_payload.get("published_fingerprints", [])

        # Determine authentication mode: GitHub App installation or User OAuth access token
        auth_mode: Optional[str] = None
        resolved_token: Optional[str] = None
        resolved_inst_id: Optional[str] = installation_id

        if not dry_run:
            if github_app_auth.is_configured():
                if not resolved_inst_id:
                    try:
                        inst = await github_app_auth.get_installation_for_repo(owner, repo)
                        resolved_inst_id = str(inst.get("installation_id", ""))
                    except Exception:
                        pass
                if resolved_inst_id:
                    auth_mode = "app"

            if not auth_mode:
                # Fallback to connected user OAuth access token or GITHUB_TOKEN PAT
                token_candidate = (
                    user_token
                    or db.get_token_for_repo(repo_full_name)
                    or getattr(settings, "GITHUB_TOKEN", None)
                )
                if token_candidate and not str(token_candidate).startswith("demo"):
                    auth_mode = "token"
                    resolved_token = str(token_candidate)

        use_dry_run = dry_run or (auth_mode is None)

        if use_dry_run:
            reason = (
                "Dry-run requested or running in demo sandbox."
                if dry_run
                else "Neither GitHub App credentials nor authorized user GitHub token were available; saved review in dry-run mode."
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
                summary_body=top_summary,
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
                "body": review_body,
                "comments": self._build_api_comments(inline_comments),
            }
            return record

        # Verify PR head SHA hasn't changed while analysis was executing
        if verify_latest_sha:
            latest_sha = await pr_diff_service.get_latest_pr_head_sha(
                owner=owner,
                repo=repo,
                pr_number=pr_number,
                installation_id=resolved_inst_id if auth_mode == "app" else None,
                user_token=resolved_token if auth_mode == "token" else None,
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
                    summary_body=top_summary,
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
            auth_mode=auth_mode,
            installation_id=resolved_inst_id,
            token=resolved_token,
            repo_full_name=repo_full_name,
            repo_id=repo_id,
            pr_number=pr_number,
            head_sha=head_sha,
            analysis_id=analysis_id,
            dedup_key=dedup_key,
            review_body=review_body,
            top_summary=top_summary,
            inline_comments=inline_comments,
            published_fps=published_fps,
            mode=mode,
            triggered_by=triggered_by,
        )

    async def retry_publish_review(
        self,
        review_record_id: str,
        installation_id: Optional[str] = None,
        user_token: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Safely retry publishing a previously failed review record."""
        existing = db.get_github_review(review_record_id)
        if not existing:
            raise FileNotFoundError(f"Review record '{review_record_id}' not found.")
        if existing.get("publication_status") == "published":
            return existing

        repo_full_name = existing["repo_full_name"]
        owner, repo = repo_full_name.split("/", 1)

        auth_mode: Optional[str] = None
        resolved_token: Optional[str] = None
        inst_id = installation_id

        if github_app_auth.is_configured():
            if not inst_id:
                try:
                    inst = await github_app_auth.get_installation_for_repo(owner, repo)
                    inst_id = str(inst.get("installation_id", ""))
                except Exception:
                    pass
            if inst_id:
                auth_mode = "app"

        if not auth_mode:
            tok = user_token or db.get_token_for_repo(repo_full_name) or getattr(settings, "GITHUB_TOKEN", None)
            if tok and not str(tok).startswith("demo"):
                auth_mode = "token"
                resolved_token = str(tok)

        if not auth_mode:
            raise GitHubAppError(
                "Cannot retry publication: Neither GitHub App credentials nor user GitHub token is available.",
                status_code=503,
            )

        # Ensure head SHA is still current before retrying
        latest_sha = await pr_diff_service.get_latest_pr_head_sha(
            owner=owner,
            repo=repo,
            pr_number=existing["pr_number"],
            installation_id=inst_id if auth_mode == "app" else None,
            user_token=resolved_token if auth_mode == "token" else None,
        )
        if latest_sha and latest_sha != existing["head_sha"]:
            raise StaleAnalysisError(existing["head_sha"], latest_sha)

        summary = existing.get("summary_body", "")
        return await self._execute_github_publish(
            review_record_id=review_record_id,
            auth_mode=auth_mode,
            installation_id=inst_id,
            token=resolved_token,
            repo_full_name=repo_full_name,
            repo_id=existing.get("repo_id"),
            pr_number=existing["pr_number"],
            head_sha=existing["head_sha"],
            analysis_id=existing.get("analysis_id"),
            dedup_key=existing["dedup_key"],
            review_body=summary,
            top_summary=summary,
            inline_comments=existing.get("inline_comments", []),
            published_fps=existing.get("published_fingerprints", []),
            mode=existing.get("mode", "manual"),
            triggered_by=existing.get("triggered_by"),
        )

    async def _execute_github_publish(
        self,
        review_record_id: str,
        auth_mode: str,
        installation_id: Optional[str],
        token: Optional[str],
        repo_full_name: str,
        repo_id: Optional[str],
        pr_number: int,
        head_sha: str,
        analysis_id: Optional[str],
        dedup_key: str,
        review_body: str,
        top_summary: str,
        inline_comments: List[Dict[str, Any]],
        published_fps: List[str],
        mode: str,
        triggered_by: Optional[str],
    ) -> Dict[str, Any]:
        # Tier 1: When inline comments are present, post or update the top-level Strix PR Summary Comment
        if inline_comments:
            try:
                comments_url = f"{self.GITHUB_API_BASE}/repos/{repo_full_name}/issues/{pr_number}/comments"
                existing_comments_res = await self._dispatch_github_request(
                    auth_mode=auth_mode,
                    installation_id=installation_id,
                    token=token,
                    method="GET",
                    url=comments_url,
                )
                existing_comment_id = None
                if existing_comments_res.status_code == 200:
                    comment_list = existing_comments_res.json()
                    if isinstance(comment_list, list):
                        for c in comment_list:
                            c_body = c.get("body", "")
                            if "REGRAVA Security Review" in c_body or "## REGRAVA Review" in c_body:
                                existing_comment_id = c.get("id")
                                break

                if existing_comment_id:
                    # Update existing comment to keep PR conversation clean (matching Strix edited banner)
                    await self._dispatch_github_request(
                        auth_mode=auth_mode,
                        installation_id=installation_id,
                        token=token,
                        method="PATCH",
                        url=f"{self.GITHUB_API_BASE}/repos/{repo_full_name}/issues/comments/{existing_comment_id}",
                        json_body={"body": top_summary},
                    )
                else:
                    # Post fresh summary comment
                    await self._dispatch_github_request(
                        auth_mode=auth_mode,
                        installation_id=installation_id,
                        token=token,
                        method="POST",
                        url=comments_url,
                        json_body={"body": top_summary},
                    )
            except Exception as exc:
                logger.warning("Could not post top PR summary comment on %s#%s: %s", repo_full_name, pr_number, exc)

        # Tier 2: Submit official Pull Request Review with event='COMMENT' and inline line comments
        url = f"{self.GITHUB_API_BASE}/repos/{repo_full_name}/pulls/{pr_number}/reviews"
        payload: Dict[str, Any] = {
            "commit_id": head_sha,
            "body": review_body,
            "event": "COMMENT",
        }
        api_comments = self._build_api_comments(inline_comments)
        if api_comments:
            payload["comments"] = api_comments

        try:
            res = await self._dispatch_github_request(
                auth_mode=auth_mode,
                installation_id=installation_id,
                token=token,
                method="POST",
                url=url,
                json_body=payload,
            )

            # Graceful 422 fallback: if inline comment diff lines failed GitHub validation,
            # fold those comments into the review body and submit cleanly without inline comments.
            if res.status_code == 422 and api_comments:
                logger.warning(
                    "GitHub returned 422 for inline comments on %s#%s; folding inline comments into summary.",
                    repo_full_name,
                    pr_number,
                )
                fallback_notes = ["", "### Detailed Findings (Inline Position Fallback)", ""]
                for c in inline_comments:
                    fallback_notes.append(f"**Location:** `{c['path']}:{c['line']}`\n\n{c['body']}\n")
                fallback_body = review_body + "\n" + "\n".join(fallback_notes)
                fallback_payload = {
                    "commit_id": head_sha,
                    "body": fallback_body,
                    "event": "COMMENT",
                }
                res = await self._dispatch_github_request(
                    auth_mode=auth_mode,
                    installation_id=installation_id,
                    token=token,
                    method="POST",
                    url=url,
                    json_body=fallback_payload,
                )
                if res.status_code in (200, 201):
                    review_body = fallback_body
                    inline_comments = []

            if res.status_code in (200, 201):
                gh_data = res.json()
                gh_review_id = str(gh_data.get("id", ""))
                gh_review_url = (
                    gh_data.get("html_url")
                    or f"https://github.com/{repo_full_name}/pull/{pr_number}#pullrequestreview-{gh_review_id}"
                )

                # Fetch posted inline comment IDs so lifecycle records track exact GitHub discussion URLs
                if inline_comments and gh_review_id:
                    try:
                        c_res = await self._dispatch_github_request(
                            auth_mode=auth_mode,
                            installation_id=installation_id,
                            token=token,
                            method="GET",
                            url=f"{self.GITHUB_API_BASE}/repos/{repo_full_name}/pulls/{pr_number}/reviews/{gh_review_id}/comments",
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
                    summary_body=top_summary,
                    inline_comments=inline_comments,
                    published_fingerprints=published_fps,
                    publication_status="published",
                    error_detail=None,
                    mode=mode,
                    triggered_by=triggered_by,
                )

            # Error handling based on HTTP status
            if res.status_code == 403:
                err_msg = (
                    "GitHub returned 403 Forbidden: verify REGRAVA GitHub connection or App has 'Pull requests: Read and write' permission."
                )
            elif res.status_code == 404:
                err_msg = f"GitHub returned 404 Not Found: PR #{pr_number} or repository '{repo_full_name}' is unavailable to this account."
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
                summary_body=top_summary,
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
                summary_body=top_summary,
                inline_comments=inline_comments,
                published_fingerprints=published_fps,
                publication_status="failed",
                error_detail=err_msg,
                mode=mode,
                triggered_by=triggered_by,
            )
            raise GitHubAppError(err_msg, status_code=502, recoverable=True) from exc


review_publisher = ReviewPublisher()
