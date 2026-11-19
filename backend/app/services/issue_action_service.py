"""
Issue Action & Auto-Close Dispatcher for REGRAVA Issue Sentinel.
Formats evidence-backed explanation comments, posts them to GitHub issues,
and closes redundant or non-existent issues when policy permits.
"""

from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional
import httpx
from app.config import settings
from app.db.session_db import db
from app.services.github_app_service import github_app_auth
from app.services.github_service import DEMO_ISSUES, github_service
from app.services.issue_verifier_service import issue_verifier_service

logger = logging.getLogger(__name__)


class IssueActionService:
    """Formats markdown evidence comments and executes GitHub issue actions."""

    def format_triage_comment(
        self,
        classification: str,
        confidence: str,
        summary: str,
        evidence: List[Dict[str, Any]],
        action_taken: str,
    ) -> str:
        """Construct a polite, evidence-backed GitHub issue comment."""
        status_badges = {
            "ALREADY_IMPLEMENTED": "🟣 **Status: Closed as Already Implemented**",
            "NON_EXISTENT_CONTEXT": "🔴 **Status: Closed (Referenced Context Does Not Exist)**",
            "VALID_OPEN_ISSUE": "🟢 **Status: Verified Open Issue**",
            "NEEDS_MORE_INFO": "🟡 **Status: Needs More Information**",
        }
        badge = status_badges.get(classification, f"ℹ️ **Status: {classification}**")

        lines = [
            "### 🤖 REGRAVA Issue Sentinel Analysis",
            "",
            badge,
            f"**Confidence**: {confidence}",
            "",
            summary,
            "",
        ]

        if evidence:
            lines.append("#### 🔍 Code Evidence & Grounding")
            for ev in evidence:
                ev_type = ev.get("type", "")
                if ev_type in ("route_implementation", "symbol_definition"):
                    fp = ev.get("file_path", "unknown")
                    start = ev.get("line_start", 1)
                    end = ev.get("line_end", start)
                    snippet = ev.get("code_snippet", "")
                    lines.append(f"- **File**: `{fp}` (lines {start}–{end})")
                    if snippet:
                        lines.append(f"```python\n{snippet}\n```")
                elif ev_type == "missing_file_context":
                    missing = ev.get("referenced_files", [])
                    lines.append(
                        f"- **Missing Paths**: `{', '.join(missing)}` (verified absent from `main` branch file tree)."
                    )
                elif ev_type == "confirmed_security_vulnerability":
                    fp = ev.get("file_path", "unknown")
                    vuln = ev.get("vulnerability_type", "Security Vulnerability")
                    snippet = ev.get("code_snippet", "")
                    lines.append(f"- **File**: `{fp}` — **{vuln}**")
                    if snippet:
                        lines.append(f"```python\n{snippet}\n```")
            lines.append("")

        if action_taken == "CLOSED":
            lines.extend([
                "> [!NOTE]",
                "> This issue was automatically closed to maintain repository quality and backlog cleanliness.",
                "> If you believe this resolution was made in error or your request differs, reply with **`@regrava reopen`** and a maintainer will review it.",
                "",
                "---",
                "*Automated triage by [REGRAVA](https://regrava.vercel.app) • Codebase AST Grounding*",
            ])
        else:
            lines.extend([
                "---",
                "*Automated triage by [REGRAVA](https://regrava.vercel.app) • Codebase AST Grounding*",
            ])

        return "\n".join(lines)

    async def execute_triage(
        self,
        repo_full_name: str,
        issue_number: int,
        user_id: Optional[str] = None,
        auto_close_override: Optional[bool] = None,
        dry_run: bool = False,
    ) -> Dict[str, Any]:
        """
        Run complete triage workflow:
        1. Fetch issue metadata.
        2. Run AST and claim verification.
        3. Check repo Sentinel settings.
        4. Post comment and optionally close issue on GitHub.
        5. Persist audit record in database.
        """
        # 1. Fetch issue
        issue = await github_service.get_issue(user_id or "system", repo_full_name, issue_number)
        title = issue.get("title", "")
        author = issue.get("author", "unknown")
        issue_url = issue.get("html_url")

        # 2. Run AST verification
        triage_res = await issue_verifier_service.verify_issue(repo_full_name, issue, user_id=user_id)
        classification = triage_res["classification"]
        confidence = triage_res["confidence"]
        summary = triage_res["summary"]
        evidence = triage_res["evidence"]
        eligible = triage_res.get("auto_close_eligible", False)

        # 3. Check repo Sentinel settings
        settings_cfg = db.get_issue_sentinel_settings(repo_full_name)
        sentinel_enabled = settings_cfg.get("enabled", True)
        repo_auto_close = settings_cfg.get("auto_close", True)
        if auto_close_override is not None:
            repo_auto_close = auto_close_override

        should_close = (
            sentinel_enabled
            and repo_auto_close
            and eligible
            and not dry_run
            and issue.get("state") == "open"
        )

        action_taken = "CLOSED" if should_close else "COMMENTED" if not dry_run else "DRY_RUN"

        comment_body = self.format_triage_comment(
            classification=classification,
            confidence=confidence,
            summary=summary,
            evidence=evidence,
            action_taken=action_taken,
        )

        comment_id = None

        # 4. Dispatch GitHub Actions or Demo Mutate
        if not dry_run:
            comment_id = await self._dispatch_comment_and_close(
                repo_full_name=repo_full_name,
                issue_number=issue_number,
                comment_body=comment_body,
                should_close=should_close,
                close_reason="not_planned" if classification == "NON_EXISTENT_CONTEXT" else "completed",
                user_id=user_id,
            )

        # 5. Persist to DB
        record = db.record_issue_triage(
            repo_full_name=repo_full_name,
            issue_number=issue_number,
            issue_title=title,
            issue_author=author,
            classification=classification,
            confidence=confidence,
            summary=summary,
            evidence=evidence,
            action_taken=action_taken,
            issue_url=issue_url,
            github_comment_id=str(comment_id) if comment_id else None,
        )

        return {
            "repo_full_name": repo_full_name,
            "issue_number": issue_number,
            "classification": classification,
            "confidence": confidence,
            "summary": summary,
            "evidence": evidence,
            "action_taken": action_taken,
            "github_comment_id": comment_id,
            "comment_body": comment_body,
            "record": record,
        }

    async def _dispatch_comment_and_close(
        self,
        repo_full_name: str,
        issue_number: int,
        comment_body: str,
        should_close: bool,
        close_reason: str = "completed",
        user_id: Optional[str] = None,
    ) -> Optional[str]:
        """Post comment and execute PATCH close request."""
        # 1. Check demo repo
        if repo_full_name in DEMO_ISSUES:
            for item in DEMO_ISSUES[repo_full_name]:
                if item["number"] == issue_number:
                    if should_close:
                        item["state"] = "closed"
                    return f"demo-comment-{issue_number}"
            return None

        # 2. Real GitHub API dispatch
        token = None
        installation_id = None
        if user_id:
            account = db.get_github_account(user_id)
            if account and account.get("access_token"):
                token = account["access_token"]

        if not token:
            cached_inst = db.find_installation_for_repo(repo_full_name)
            if cached_inst:
                installation_id = cached_inst["installation_id"]

        comment_id = None
        try:
            # Post comment
            comment_url = f"https://api.github.com/repos/{repo_full_name}/issues/{issue_number}/comments"
            if installation_id:
                res = await github_app_auth.request_with_installation(
                    installation_id, "POST", comment_url, json_body={"body": comment_body}
                )
            elif token:
                async with httpx.AsyncClient(timeout=15.0) as client:
                    res = await client.post(
                        comment_url,
                        json={"body": comment_body},
                        headers={"Authorization": f"Bearer {token}", "Accept": "application/vnd.github.v3+json"},
                    )
            else:
                return None

            if res and res.status_code in (200, 201):
                comment_id = str(res.json().get("id", ""))

            # Close issue if requested
            if should_close:
                close_url = f"https://api.github.com/repos/{repo_full_name}/issues/{issue_number}"
                close_payload = {"state": "closed", "state_reason": close_reason}
                if installation_id:
                    await github_app_auth.request_with_installation(
                        installation_id, "PATCH", close_url, json_body=close_payload
                    )
                elif token:
                    async with httpx.AsyncClient(timeout=15.0) as client:
                        await client.patch(
                            close_url,
                            json=close_payload,
                            headers={"Authorization": f"Bearer {token}", "Accept": "application/vnd.github.v3+json"},
                        )
        except Exception as exc:
            logger.warning(f"Failed to post comment/close issue on GitHub: {exc}")

        return comment_id

    async def reopen_issue(
        self,
        repo_full_name: str,
        issue_number: int,
        reopened_by: str,
        user_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Reopen an issue previously closed by REGRAVA Sentinel."""
        # 1. Update demo if applicable
        if repo_full_name in DEMO_ISSUES:
            for item in DEMO_ISSUES[repo_full_name]:
                if item["number"] == issue_number:
                    item["state"] = "open"

        # 2. Real GitHub call
        token = None
        installation_id = None
        if user_id:
            account = db.get_github_account(user_id)
            if account and account.get("access_token"):
                token = account["access_token"]
        if not token:
            cached_inst = db.find_installation_for_repo(repo_full_name)
            if cached_inst:
                installation_id = cached_inst["installation_id"]

        comment_body = (
            f"### 🤖 REGRAVA Sentinel Reopen Override\n\n"
            f"Issue #{issue_number} was reopened per request from @{reopened_by}. "
            "Handing over to human maintainers."
        )

        try:
            close_url = f"https://api.github.com/repos/{repo_full_name}/issues/{issue_number}"
            comment_url = f"https://api.github.com/repos/{repo_full_name}/issues/{issue_number}/comments"

            if installation_id:
                await github_app_auth.request_with_installation(
                    installation_id, "PATCH", close_url, json_body={"state": "open"}
                )
                await github_app_auth.request_with_installation(
                    installation_id, "POST", comment_url, json_body={"body": comment_body}
                )
            elif token:
                async with httpx.AsyncClient(timeout=15.0) as client:
                    await client.patch(
                        close_url,
                        json={"state": "open"},
                        headers={"Authorization": f"Bearer {token}", "Accept": "application/vnd.github.v3+json"},
                    )
                    await client.post(
                        comment_url,
                        json={"body": comment_body},
                        headers={"Authorization": f"Bearer {token}", "Accept": "application/vnd.github.v3+json"},
                    )
        except Exception as exc:
            logger.warning(f"Failed to reopen issue on GitHub: {exc}")

        # Update DB record
        record = db.get_issue_triage(repo_full_name, issue_number)
        if record:
            db.record_issue_triage(
                repo_full_name=repo_full_name,
                issue_number=issue_number,
                issue_title=record.get("issue_title", ""),
                issue_author=record.get("issue_author", ""),
                classification=record.get("classification", "VALID_OPEN_ISSUE"),
                confidence=record.get("confidence", "HIGH"),
                summary=f"Reopened by @{reopened_by}.",
                evidence=record.get("evidence", []),
                action_taken="REOPENED",
            )

        return {"status": "reopened", "repo_full_name": repo_full_name, "issue_number": issue_number}


issue_action_service = IssueActionService()
