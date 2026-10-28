"""
Repository analysis endpoints for RepoSentinel.
Allows analyzing local repositories located in the workspaces/ directory.
"""

import os
from pathlib import Path
from typing import List, Optional
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from app.analyzer.git_reader import GitReader, InvalidRepositoryError, InvalidRevisionError
from app.config import settings
from app.models.analysis import AnalysisResult
from app.services.analysis_service import SecurityError, analysis_service

router = APIRouter(prefix="", tags=["Analysis"])


class RepositoryInfo(BaseModel):
    name: str
    relative_path: str
    is_git_repo: bool
    branches: List[str]


class RepositoryAnalyzeRequest(BaseModel):
    repo_name: str
    base_ref: str = "main"
    head_ref: str = "HEAD"


@router.get("/repositories", response_model=List[RepositoryInfo])
def list_repositories():
    """List accessible repositories in the workspace directory."""
    repos: List[RepositoryInfo] = []

    # Check both workspaces and demo git_repo
    scan_dirs = [settings.WORKSPACES_DIR, settings.EXAMPLES_DIR]

    for root_dir in scan_dirs:
        if not root_dir.exists():
            continue

        for item in root_dir.iterdir():
            if item.is_dir() and (item / ".git").exists():
                branches: List[str] = []
                try:
                    reader = GitReader(item)
                    _, stdout, _ = reader._run_git(["branch", "--list", "--format=%(refname:short)"])
                    branches = [b.strip() for b in stdout.splitlines() if b.strip()]
                    # Also fetch tags
                    _, tag_out, _ = reader._run_git(["tag", "-l"])
                    tags = [t.strip() for t in tag_out.splitlines() if t.strip()]
                    branches.extend(tags)
                except Exception:
                    pass

                rel_p = str(item.relative_to(settings.PROJECT_ROOT)).replace("\\", "/")
                repos.append(
                    RepositoryInfo(
                        name=item.name,
                        relative_path=rel_p,
                        is_git_repo=True,
                        branches=branches,
                    )
                )

    return repos


@router.post("/analyze/repository", response_model=AnalysisResult)
def analyze_repository(request: RepositoryAnalyzeRequest):
    """Run regression risk analysis on a local Git repository."""
    # Find matching directory in allowed paths
    target_path: Optional[Path] = None

    candidate_workspaces = settings.WORKSPACES_DIR / request.repo_name
    candidate_examples = settings.EXAMPLES_DIR / request.repo_name

    if candidate_workspaces.exists() and candidate_workspaces.is_dir():
        target_path = candidate_workspaces
    elif candidate_examples.exists() and candidate_examples.is_dir():
        target_path = candidate_examples
    elif request.repo_name in ["git_repo", "demo_project/git_repo"]:
        target_path = settings.EXAMPLES_DIR / "git_repo"

    if not target_path or not target_path.exists():
        raise HTTPException(
            status_code=404,
            detail=f"Repository '{request.repo_name}' not found in workspaces directory.",
        )

    # Validate security boundaries
    try:
        validated_path = analysis_service.validate_workspace_path(target_path)
    except SecurityError as e:
        raise HTTPException(status_code=403, detail=str(e))

    try:
        result = analysis_service.analyze_git_repository(
            repo_path=validated_path,
            base_ref=request.base_ref,
            head_ref=request.head_ref,
            target_name=request.repo_name,
        )
        return result
    except (InvalidRepositoryError, InvalidRevisionError) as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")


@router.get("/analysis/{analysis_id}", response_model=AnalysisResult)
def get_analysis_by_id(analysis_id: str):
    """Retrieve an existing analysis report by ID."""
    if analysis_id not in analysis_service.results_store:
        raise HTTPException(status_code=404, detail="Analysis result not found.")
    return analysis_service.results_store[analysis_id]
