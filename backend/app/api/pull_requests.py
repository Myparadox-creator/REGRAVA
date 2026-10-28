"""
Repository & Pull Request Analysis API endpoints for REGRAVA.
Enforces strict per-user authorization boundaries on every repository and PR request.
"""

from typing import Dict, List, Optional, Any
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from app.db.session_db import db
from app.services.auth_service import get_current_user
from app.services.github_service import github_service
from app.services.pr_analysis_service import pr_analysis_service

router = APIRouter(tags=["Pull Requests"])


class ReviewFindingRequest(BaseModel):
    status: str  # "reviewed" | "dismissed" | "open"
    notes: Optional[str] = None


@router.get("/repos")
async def list_authorized_repos(current_user: Dict[str, Any] = Depends(get_current_user)):
    """List repositories authorized for the current user."""
    repos = await github_service.list_authorized_repositories(current_user["id"])
    return repos


@router.get("/repos/{owner}/{repo}/pulls")
async def list_repo_pulls(
    owner: str,
    repo: str,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """List pull requests for an authorized repository."""
    full_name = f"{owner}/{repo}"
    try:
        prs = await github_service.list_pull_requests(current_user["id"], full_name)
        return prs
    except PermissionError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch pull requests: {str(e)}")


@router.post("/repos/{owner}/{repo}/pulls/{number}/analyze")
async def analyze_pull_request(
    owner: str,
    repo: str,
    number: int,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """Execute evidence-based security and regression analysis on a pull request."""
    full_name = f"{owner}/{repo}"
    try:
        result = await pr_analysis_service.analyze_pull_request(
            user_id=current_user["id"],
            repo_name=full_name,
            pr_number=number,
        )
        return result
    except PermissionError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))
    except FileNotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")


@router.get("/analysis/pr/{analysis_id}")
def get_pr_analysis_result(
    analysis_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """Retrieve previously executed PR analysis results by ID."""
    result = db.get_pr_analysis(analysis_id)
    if not result:
        raise HTTPException(status_code=404, detail="Analysis result not found.")

    # Authorization check: verify analysis belongs to the user or is a demo analysis
    if result["user_id"] != current_user["id"] and not current_user.get("is_demo"):
        raise HTTPException(status_code=403, detail="Access denied to this analysis record.")

    return result


@router.patch("/analysis/pr/{analysis_id}/findings/{finding_id}")
def update_finding_review_status(
    analysis_id: str,
    finding_id: str,
    request: ReviewFindingRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """Mark a finding as reviewed or dismissed with optional reviewer notes."""
    result = db.get_pr_analysis(analysis_id)
    if not result:
        raise HTTPException(status_code=404, detail="Analysis result not found.")

    if result["user_id"] != current_user["id"] and not current_user.get("is_demo"):
        raise HTTPException(status_code=403, detail="Access denied.")

    if request.status not in ["reviewed", "dismissed", "open"]:
        raise HTTPException(status_code=400, detail="Invalid status. Must be 'reviewed', 'dismissed', or 'open'.")

    db.update_finding_review(analysis_id, finding_id, request.status, request.notes)
    return {"status": "updated", "finding_id": finding_id, "new_status": request.status}


@router.get("/analysis/history")
def get_analysis_history(
    limit: int = 50,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """List historical PR analysis executions for the current user."""
    history = db.list_analyses_for_user(current_user["id"], limit=limit)
    return history
