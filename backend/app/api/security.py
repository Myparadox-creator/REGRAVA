"""
Security Posture & Health API endpoints for REGRAVA.
Serves repository-level security scores, 7-layer check results, and compliance health metrics.
"""

from typing import Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status
from app.services.auth_service import get_current_user
from app.services.security_posture_service import security_posture_service
from app.services.pr_analysis_service import pr_analysis_service
from app.services.github_service import github_service

router = APIRouter(prefix="/security", tags=["Security Posture"])


@router.get("/posture")
async def get_security_posture(current_user: Dict[str, Any] = Depends(get_current_user)):
    """
    Retrieve fleet-wide security health posture and individual repository scores.
    Evaluates all 7 security layers deterministically per repository.
    """
    try:
        posture = await security_posture_service.get_fleet_security_posture(current_user["id"])
        return posture
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate security posture: {str(e)}",
        )


@router.get("/repository/{owner}/{repo}")
async def get_repository_security_health(
    owner: str,
    repo: str,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """
    Retrieve in-depth security health check for a single individual repository.
    Includes 7-layer check statuses, health score, and open findings.
    """
    health = await security_posture_service.get_repository_security_health(
        current_user["id"], owner, repo
    )
    if not health:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Repository '{owner}/{repo}' not found or not authorized.",
        )
    return health


@router.post("/audit/{owner}/{repo}")
async def trigger_repository_audit(
    owner: str,
    repo: str,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """
    Trigger an on-demand security and contract audit for a repository.
    Analyzes the latest open pull request or primary benchmark diff.
    """
    full_name = f"{owner}/{repo}"
    try:
        # Check open PRs for this repo
        prs = await github_service.list_pull_requests(current_user["id"], full_name)
        if not prs:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"No open pull requests found to audit for '{full_name}'. Create a PR to trigger an audit.",
            )

        # Audit the latest PR
        latest_pr = prs[0]
        pr_number = latest_pr["number"]

        analysis = await pr_analysis_service.analyze_pull_request(
            user_id=current_user["id"],
            repo_name=full_name,
            pr_number=pr_number,
        )

        # Re-fetch updated posture for this user
        updated_posture = await security_posture_service.get_fleet_security_posture(current_user["id"])
        repo_health = next(
            (r for r in updated_posture.get("repositories", []) if r["repo_full_name"].lower() == full_name.lower()),
            None,
        )

        return {
            "status": "audited",
            "repo_full_name": full_name,
            "pr_number": pr_number,
            "analysis_id": analysis.get("id"),
            "health_score": repo_health.get("health_score") if repo_health else None,
            "health_grade": repo_health.get("health_grade") if repo_health else None,
            "repo_health": repo_health,
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Audit failed: {str(e)}",
        )
