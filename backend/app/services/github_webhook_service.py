"""
GitHub Webhook Processing Service for REGRAVA.
Verifies HMAC-SHA256 webhook signatures (`X-Hub-Signature-256`), enforces delivery
idempotency (`X-GitHub-Delivery`), synchronizes GitHub App installations, and
triggers automatic PR reviews when enabled per repository.
"""

from __future__ import annotations

import hashlib
import hmac
import logging
from typing import Any, Dict, List, Optional
from fastapi import BackgroundTasks
from app.config import settings
from app.db.session_db import db
from app.services.github_app_service import github_app_auth
from app.services.regrava_review_service import regrava_review_service

logger = logging.getLogger(__name__)


class WebhookSignatureError(Exception):
    """Raised when webhook signature verification fails."""
    pass


class GitHubWebhookService:
    """Handles signed GitHub App webhook events safely and idempotently."""

    SUPPORTED_PR_ACTIONS = {"opened", "synchronize", "reopened", "ready_for_review"}

    def verify_signature(self, payload_body: bytes, signature_header: Optional[str]) -> bool:
        """Verify `X-Hub-Signature-256` against the configured webhook secret."""
        secret = settings.get_github_webhook_secret()
        if not secret:
            raise WebhookSignatureError("GitHub webhook secret is not configured on backend.")
        if not signature_header or not signature_header.startswith("sha256="):
            raise WebhookSignatureError("Missing or malformed X-Hub-Signature-256 header.")

        expected_sig = "sha256=" + hmac.new(
            secret.encode("utf-8"),
            payload_body,
            hashlib.sha256,
        ).hexdigest()

        if not hmac.compare_digest(expected_sig, signature_header):
            raise WebhookSignatureError("Invalid webhook signature.")
        return True

    async def process_event(
        self,
        event_type: str,
        delivery_id: Optional[str],
        payload: Dict[str, Any],
        background_tasks: Optional[BackgroundTasks] = None,
        run_sync: bool = False,
    ) -> Dict[str, Any]:
        """Process a verified GitHub webhook event idempotently."""
        repo_full_name = (payload.get("repository") or {}).get("full_name")

        # 1. Idempotent delivery tracking
        if delivery_id:
            is_new = db.record_webhook_delivery(
                delivery_id=delivery_id,
                event_type=event_type,
                repo_full_name=repo_full_name,
                summary=f"action={payload.get('action')}",
            )
            if not is_new:
                return {
                    "status": "duplicate_ignored",
                    "delivery_id": delivery_id,
                    "event": event_type,
                }

        action = payload.get("action", "")

        # 2. Installation lifecycle events
        if event_type == "installation":
            return self._handle_installation(action, payload)

        if event_type == "installation_repositories":
            return self._handle_installation_repositories(action, payload)

        # 3. Pull Request events
        if event_type == "pull_request":
            return await self._handle_pull_request(
                action=action,
                payload=payload,
                background_tasks=background_tasks,
                run_sync=run_sync,
            )

        return {"status": "ignored", "reason": f"Unhandled event '{event_type}'."}

    def _handle_installation(self, action: str, payload: Dict[str, Any]) -> Dict[str, Any]:
        inst = payload.get("installation") or {}
        inst_id = str(inst.get("id", ""))
        if not inst_id:
            return {"status": "ignored", "reason": "Missing installation id"}

        if action == "deleted":
            db.delete_installation(inst_id)
            return {"status": "installation_deleted", "installation_id": inst_id}

        account = inst.get("account") or {}
        repos = [
            r.get("full_name")
            for r in payload.get("repositories", [])
            if r.get("full_name")
        ]
        suspended = action == "suspend" or bool(inst.get("suspended_at"))
        db.upsert_installation(
            installation_id=inst_id,
            account_login=account.get("login"),
            account_type=account.get("type"),
            repositories=repos,
            repository_selection=inst.get("repository_selection", "selected"),
            suspended=suspended,
        )
        return {
            "status": f"installation_{action or 'synced'}",
            "installation_id": inst_id,
            "repositories_count": len(repos),
        }

    def _handle_installation_repositories(self, action: str, payload: Dict[str, Any]) -> Dict[str, Any]:
        inst = payload.get("installation") or {}
        inst_id = str(inst.get("id", ""))
        if not inst_id:
            return {"status": "ignored", "reason": "Missing installation id"}

        added = [r.get("full_name") for r in payload.get("repositories_added", []) if r.get("full_name")]
        removed = [r.get("full_name") for r in payload.get("repositories_removed", []) if r.get("full_name")]
        db.update_installation_repos(inst_id, added=added, removed=removed)
        return {
            "status": "installation_repositories_updated",
            "installation_id": inst_id,
            "added": len(added),
            "removed": len(removed),
        }

    async def _handle_pull_request(
        self,
        action: str,
        payload: Dict[str, Any],
        background_tasks: Optional[BackgroundTasks],
        run_sync: bool = False,
    ) -> Dict[str, Any]:
        if action not in self.SUPPORTED_PR_ACTIONS:
            return {"status": "ignored", "reason": f"PR action '{action}' is not subscribed for review."}

        pr_obj = payload.get("pull_request") or {}
        repo_obj = payload.get("repository") or {}
        inst_obj = payload.get("installation") or {}

        repo_full_name = repo_obj.get("full_name")
        pr_number = pr_obj.get("number")
        inst_id = str(inst_obj.get("id", "")) if inst_obj.get("id") else None

        if not repo_full_name or pr_number is None:
            return {"status": "ignored", "reason": "Missing repository or PR number."}

        # Ignore draft PRs until ready_for_review
        if pr_obj.get("draft") and action != "ready_for_review":
            return {"status": "ignored", "reason": "Draft PR skipped until marked ready_for_review."}

        # Verify installation access for this repository
        if inst_id:
            accessible = await github_app_auth.verify_repo_accessible_to_installation(
                inst_id, repo_full_name
            )
            if not accessible:
                return {
                    "status": "rejected",
                    "reason": f"Repository '{repo_full_name}' is not accessible under installation {inst_id}.",
                }
        else:
            cached_inst = db.find_installation_for_repo(repo_full_name)
            if not cached_inst:
                return {
                    "status": "rejected",
                    "reason": f"No active GitHub App installation found for '{repo_full_name}'.",
                }
            inst_id = cached_inst["installation_id"]

        # Check per-repository automatic review toggle (defaults to OFF!)
        repo_cfg = db.get_repo_settings(repo_full_name)
        if not repo_cfg.get("auto_review_enabled", False):
            return {
                "status": "skipped_auto_review_disabled",
                "repo_full_name": repo_full_name,
                "pr_number": pr_number,
                "message": "Automatic PR review is disabled for this repository.",
            }

        owner, repo = repo_full_name.split("/", 1)
        job = regrava_review_service.authorize_and_create_job(
            user_id=None,
            owner=owner,
            repo=repo,
            pr_number=int(pr_number),
            dry_run=False,
            mode="automatic",
        )

        if run_sync or background_tasks is None:
            await regrava_review_service.execute_review_job(
                job_id=job["job_id"],
                user_id=None,
                owner=owner,
                repo=repo,
                pr_number=int(pr_number),
                installation_id=inst_id,
                force_re_review=False,
                dry_run=False,
                mode="automatic",
                triggered_by=f"webhook:{action}",
            )
        else:
            background_tasks.add_task(
                regrava_review_service.execute_review_job,
                job_id=job["job_id"],
                user_id=None,
                owner=owner,
                repo=repo,
                pr_number=int(pr_number),
                installation_id=inst_id,
                force_re_review=False,
                dry_run=False,
                mode="automatic",
                triggered_by=f"webhook:{action}",
            )

        return {
            "status": "review_triggered",
            "job_id": job["job_id"],
            "repo_full_name": repo_full_name,
            "pr_number": pr_number,
            "action": action,
        }


github_webhook_service = GitHubWebhookService()
