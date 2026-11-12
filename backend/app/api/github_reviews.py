"""
Native GitHub Pull Request Reviewer & Webhook API endpoints for REGRAVA.
Manages asynchronous PR review jobs, review publication & safe retries,
per-repository auto-review settings, cross-commit finding lifecycle, and
HMAC-verified GitHub webhooks.
"""

from __future__ import annotations

import os
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request, status
from pydantic import BaseModel
from app.config import settings
from app.db.session_db import db
from app.services.auth_service import get_current_user
from app.services.github_app_service import GitHubAppError, github_app_auth
from app.services.github_webhook_service import WebhookSignatureError, github_webhook_service
from app.services.pull_request_diff_service import pr_diff_service
from app.services.regrava_review_service import regrava_review_service
from app.services.review_lifecycle_service import VALID_LIFECYCLE_STATUSES
from app.services.review_publisher_service import StaleAnalysisError, review_publisher

router = APIRouter(tags=["GitHub PR Reviews"])


class StartPRReviewRequest(BaseModel):
    force_re_review: bool = False
    dry_run: bool = False
    wait_for_completion: bool = False


class RepoReviewSettingsRequest(BaseModel):
    auto_review_enabled: bool
    confidence_threshold: str = "medium"


class LifecycleStatusUpdateRequest(BaseModel):
    status: str
    notes: Optional[str] = None
    verification_evidence: Optional[str] = None


@router.get("/github/app/status")
def get_github_app_status(current_user: Dict[str, Any] = Depends(get_current_user)):
    """Return safe, non-secret GitHub App integration readiness metadata."""
    return {
        "is_app_configured": github_app_auth.is_configured(),
        "app_name": settings.GITHUB_APP_NAME,
        "webhook_configured": settings.is_webhook_configured,
        "analyzer_version": settings.ANALYZER_VERSION,
        "confidence_threshold_default": settings.REVIEW_CONFIDENCE_THRESHOLD,
        "required_permissions": {
            "metadata": "read",
            "contents": "read",
            "pull_requests": "write",
        },
        "subscribed_events": [
            "pull_request",
            "installation",
            "installation_repositories",
        ],
    }


@router.post("/repos/{owner}/{repo}/pulls/{number}/review")
async def start_pr_review(
    owner: str,
    repo: str,
    number: int,
    background_tasks: BackgroundTasks,
    request: Optional[StartPRReviewRequest] = None,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """
    Start a REGRAVA native PR review (collect diff, run checks, publish to GitHub).
    Enforces strict authorization before creating the background review job.
    """
    req = request or StartPRReviewRequest()
    full_name = f"{owner}/{repo}"

    try:
        job = regrava_review_service.authorize_and_create_job(
            user_id=current_user["id"],
            owner=owner,
            repo=repo,
            pr_number=number,
            dry_run=req.dry_run,
            mode="manual",
        )
    except PermissionError as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc))

    # In serverless (Vercel) or when client explicitly asks to await completion,
    # execute within the request lifecycle so background work is never frozen.
    should_await = req.wait_for_completion or bool(os.getenv("VERCEL"))
    if should_await:
        final_job = await regrava_review_service.execute_review_job(
            job_id=job["job_id"],
            user_id=current_user["id"],
            owner=owner,
            repo=repo,
            pr_number=number,
            force_re_review=req.force_re_review,
            dry_run=req.dry_run,
            mode="manual",
            triggered_by=current_user.get("email") or current_user["id"],
        )
        return _enrich_job_response(final_job)

    background_tasks.add_task(
        regrava_review_service.execute_review_job,
        job_id=job["job_id"],
        user_id=current_user["id"],
        owner=owner,
        repo=repo,
        pr_number=number,
        force_re_review=req.force_re_review,
        dry_run=req.dry_run,
        mode="manual",
        triggered_by=current_user.get("email") or current_user["id"],
    )
    return _enrich_job_response(job)


def _enrich_job_response(job: Dict[str, Any]) -> Dict[str, Any]:
    """Attach linked review record and analysis summary when ready."""
    out = dict(job)
    if job.get("review_record_id"):
        rev = db.get_github_review(job["review_record_id"])
        if rev:
            out["review"] = rev
    return out


@router.get("/reviews/jobs/{job_id}")
def get_review_job_progress(
    job_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """Poll asynchronous progress for a REGRAVA PR review job."""
    job = db.get_review_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Review job not found.")

    if job["user_id"] != current_user["id"] and not current_user.get("is_demo"):
        # Also allow if user has repo access
        try:
            pr_diff_service.verify_user_authorization(current_user["id"], job["repo_full_name"])
        except PermissionError:
            raise HTTPException(status_code=403, detail="Access denied to this review job.")

    return _enrich_job_response(job)


@router.get("/repos/{owner}/{repo}/pulls/{number}/reviews")
def list_pr_reviews(
    owner: str,
    repo: str,
    number: int,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """Retrieve review history, latest job state, and finding lifecycle records for a PR."""
    full_name = f"{owner}/{repo}"
    try:
        pr_diff_service.verify_user_authorization(current_user["id"], full_name)
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc))

    reviews = db.list_github_reviews(repo_full_name=full_name, pr_number=number)
    latest_job = db.get_latest_review_job(full_name, number)
    lifecycle = db.list_finding_lifecycle_for_pr(full_name, number)
    repo_cfg = db.get_repo_settings(full_name)

    return {
        "repo_full_name": full_name,
        "pr_number": number,
        "reviews": reviews,
        "latest_job": _enrich_job_response(latest_job) if latest_job else None,
        "finding_lifecycle": lifecycle,
        "settings": repo_cfg,
    }


@router.get("/reviews")
def list_user_reviews(
    repo: Optional[str] = None,
    limit: int = 50,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """List recent GitHub reviews across repositories the signed-in user can access."""
    all_reviews = db.list_github_reviews(repo_full_name=repo, limit=limit)
    authorized = []
    for r in all_reviews:
        if db.check_repo_access(current_user["id"], r["repo_full_name"]):
            authorized.append(r)
    return authorized


@router.get("/reviews/{review_record_id}")
def get_review_details(
    review_record_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """Retrieve a specific REGRAVA GitHub review record and inline comments."""
    rev = db.get_github_review(review_record_id)
    if not rev:
        raise HTTPException(status_code=404, detail="Review record not found.")

    try:
        pr_diff_service.verify_user_authorization(current_user["id"], rev["repo_full_name"])
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc))

    return rev


@router.post("/reviews/{review_record_id}/retry")
async def retry_review_publication(
    review_record_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """Safely retry publishing a previously failed review without re-running full analysis."""
    rev = db.get_github_review(review_record_id)
    if not rev:
        raise HTTPException(status_code=404, detail="Review record not found.")

    try:
        pr_diff_service.verify_user_authorization(current_user["id"], rev["repo_full_name"])
        updated = await review_publisher.retry_publish_review(review_record_id)
        return updated
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc))
    except StaleAnalysisError as exc:
        raise HTTPException(status_code=409, detail=str(exc))
    except GitHubAppError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message)


@router.get("/repos/{owner}/{repo}/review-settings")
def get_repo_review_settings(
    owner: str,
    repo: str,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """Get per-repository automatic PR review settings (defaults to OFF)."""
    full_name = f"{owner}/{repo}"
    try:
        pr_diff_service.verify_user_authorization(current_user["id"], full_name)
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc))
    return db.get_repo_settings(full_name)


@router.put("/repos/{owner}/{repo}/review-settings")
def update_repo_review_settings(
    owner: str,
    repo: str,
    request: RepoReviewSettingsRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """Enable or disable automatic PR reviews on new commits/PRs for a repository."""
    full_name = f"{owner}/{repo}"
    try:
        pr_diff_service.verify_user_authorization(current_user["id"], full_name)
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc))

    if request.confidence_threshold.lower() not in ("high", "medium", "low"):
        raise HTTPException(status_code=400, detail="confidence_threshold must be 'high', 'medium', or 'low'.")

    return db.upsert_repo_settings(
        repo_full_name=full_name,
        auto_review_enabled=request.auto_review_enabled,
        confidence_threshold=request.confidence_threshold.lower(),
        updated_by=current_user.get("email") or current_user["id"],
    )


@router.get("/repos/{owner}/{repo}/pulls/{number}/findings/lifecycle")
def get_pr_findings_lifecycle(
    owner: str,
    repo: str,
    number: int,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """Retrieve cross-commit finding lifecycle history for a pull request."""
    full_name = f"{owner}/{repo}"
    try:
        pr_diff_service.verify_user_authorization(current_user["id"], full_name)
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc))
    return db.list_finding_lifecycle_for_pr(full_name, number)


@router.patch("/findings/lifecycle/{record_id}")
def update_finding_lifecycle(
    record_id: str,
    request: LifecycleStatusUpdateRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """Update resolution status of a tracked finding across commits."""
    existing = db.get_finding_lifecycle_by_id(record_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Lifecycle record not found.")

    try:
        pr_diff_service.verify_user_authorization(current_user["id"], existing["repo_full_name"])
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc))

    if request.status not in VALID_LIFECYCLE_STATUSES:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid lifecycle status. Allowed: {sorted(VALID_LIFECYCLE_STATUSES)}",
        )

    if request.status in ("Dismissed with Reason", "Accepted with Reason") and not (request.notes and request.notes.strip()):
        raise HTTPException(
            status_code=400,
            detail=f"A written reason/notes is required when setting status to '{request.status}'.",
        )

    if request.status == "Verified Fixed" and not (request.verification_evidence and request.verification_evidence.strip()):
        raise HTTPException(
            status_code=400,
            detail="Verification evidence is required to mark a finding as 'Verified Fixed'.",
        )

    updated = db.update_finding_lifecycle_status(
        record_id=record_id,
        new_status=request.status,
        notes=request.notes,
        verification_evidence=request.verification_evidence,
    )
    return updated


@router.post("/webhooks/github")
async def github_webhook_receiver(
    request: Request,
    background_tasks: BackgroundTasks,
):
    """
    Receive signed GitHub App webhook events (`pull_request`, `installation`, `installation_repositories`).
    Validates X-Hub-Signature-256 and enforces delivery ID idempotency.
    """
    raw_body = await request.body()
    signature = request.headers.get("X-Hub-Signature-256")
    event_type = request.headers.get("X-GitHub-Event", "")
    delivery_id = request.headers.get("X-GitHub-Delivery")

    try:
        github_webhook_service.verify_signature(raw_body, signature)
    except WebhookSignatureError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(exc))

    try:
        payload = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON webhook payload.")

    run_sync = bool(os.getenv("VERCEL"))
    result = await github_webhook_service.process_event(
        event_type=event_type,
        delivery_id=delivery_id,
        payload=payload,
        background_tasks=background_tasks,
        run_sync=run_sync,
    )
    return result
