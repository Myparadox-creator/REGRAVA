"""
Issue Sentinel API Endpoints for REGRAVA.
Provides on-demand and automatic issue validation, claim verification,
evidence generation, automated closing of redundant/hallucinated issues,
and triage audit history.
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from app.db.session_db import db
from app.services.auth_service import get_current_user
from app.services.github_service import github_service
from app.services.issue_action_service import issue_action_service

router = APIRouter(tags=["Issue Sentinel"])


class TriageIssueRequest(BaseModel):
    auto_close: Optional[bool] = None
    dry_run: bool = False


class IssueSentinelSettingsRequest(BaseModel):
    enabled: bool = True
    auto_close: bool = True
    mode: str = "comment_and_close"


@router.get("/repos/{owner}/{repo}/issues")
async def list_repo_issues(
    owner: str,
    repo: str,
    state: str = Query("open", pattern="^(open|closed|all)$"),
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """List issues for a repository, enriched with REGRAVA triage metadata."""
    repo_full_name = f"{owner}/{repo}"
    try:
        raw_issues = await github_service.list_issues(
            user_id=current_user["id"], repo_full_name=repo_full_name, state=state
        )
    except PermissionError as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Failed to fetch issues: {exc}")

    # Enrich with latest triage records
    enriched = []
    for issue in raw_issues:
        num = issue["number"]
        triage_record = db.get_issue_triage(repo_full_name, num)
        issue_copy = dict(issue)
        issue_copy["triage"] = triage_record
        enriched.append(issue_copy)

    return enriched


@router.get("/repos/{owner}/{repo}/issues/settings")
def get_repo_sentinel_settings(
    owner: str,
    repo: str,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """Retrieve Issue Sentinel settings for a repository."""
    repo_full_name = f"{owner}/{repo}"
    return db.get_issue_sentinel_settings(repo_full_name)


@router.post("/repos/{owner}/{repo}/issues/settings")
def update_repo_sentinel_settings(
    owner: str,
    repo: str,
    req: IssueSentinelSettingsRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """Update Issue Sentinel settings for a repository."""
    repo_full_name = f"{owner}/{repo}"
    return db.upsert_issue_sentinel_settings(
        repo_full_name=repo_full_name,
        enabled=req.enabled,
        auto_close=req.auto_close,
        mode=req.mode,
    )


@router.get("/repos/{owner}/{repo}/issues/{issue_number}")
async def get_repo_issue(
    owner: str,
    repo: str,
    issue_number: int,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """Get single issue details and its latest triage record."""
    repo_full_name = f"{owner}/{repo}"
    try:
        issue = await github_service.get_issue(
            user_id=current_user["id"], repo_full_name=repo_full_name, issue_number=issue_number
        )
    except PermissionError as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc))
    except FileNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))

    triage_record = db.get_issue_triage(repo_full_name, issue_number)
    issue_copy = dict(issue)
    issue_copy["triage"] = triage_record
    return issue_copy


@router.post("/repos/{owner}/{repo}/issues/{issue_number}/triage")
async def trigger_issue_triage(
    owner: str,
    repo: str,
    issue_number: int,
    request: TriageIssueRequest = TriageIssueRequest(),
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """Run REGRAVA Issue Sentinel triage on a specific issue."""
    repo_full_name = f"{owner}/{repo}"
    try:
        result = await issue_action_service.execute_triage(
            repo_full_name=repo_full_name,
            issue_number=issue_number,
            user_id=current_user["id"],
            auto_close_override=request.auto_close,
            dry_run=request.dry_run,
        )
        return result
    except PermissionError as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc))
    except FileNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Triage execution failed: {exc}")


@router.post("/repos/{owner}/{repo}/issues/{issue_number}/reopen")
async def reopen_issue_endpoint(
    owner: str,
    repo: str,
    issue_number: int,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """Reopen an issue previously closed by REGRAVA Sentinel."""
    repo_full_name = f"{owner}/{repo}"
    reopened_by = current_user.get("login") or current_user.get("name") or "maintainer"
    try:
        res = await issue_action_service.reopen_issue(
            repo_full_name=repo_full_name,
            issue_number=issue_number,
            reopened_by=reopened_by,
            user_id=current_user["id"],
        )
        return res
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Failed to reopen issue: {exc}")


@router.get("/issues/stats")
def get_issue_stats(
    repo: Optional[str] = None,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """Get aggregated metrics on triaged issues, auto-closures, and maintainer hours saved."""
    return db.get_issue_triage_stats(repo)


@router.get("/issues/triage-history")
def get_triage_history(
    repo: Optional[str] = None,
    limit: int = Query(50, ge=1, le=200),
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """List recent issue triage audit records."""
    return db.list_issue_triage(repo_full_name=repo, limit=limit)
