"""
Pytest configuration and shared fixtures for REGRAVA backend tests.
Ensures reproducible test fixtures including demo git repository initialization.
"""

import os
import shutil
import subprocess
from pathlib import Path
import pytest
from app.config import settings


@pytest.fixture(scope="session", autouse=True)
def setup_demo_git_repo():
    """Ensure examples/demo_project/git_repo is initialized with baseline and breaking branches."""
    repo_dir = settings.EXAMPLES_DIR / "git_repo"
    git_dir = repo_dir / ".git"

    if not git_dir.exists():
        repo_dir.mkdir(parents=True, exist_ok=True)
        subprocess.run(["git", "init"], cwd=repo_dir, check=True, capture_output=True)
        subprocess.run(["git", "config", "user.name", "REGRAVA Test"], cwd=repo_dir, check=True, capture_output=True)
        subprocess.run(["git", "config", "user.email", "test@regrava.local"], cwd=repo_dir, check=True, capture_output=True)

        # Baseline commit
        base_dir = settings.EXAMPLES_DIR / "base"
        for item in base_dir.iterdir():
            dest = repo_dir / item.name
            if item.is_dir():
                shutil.copytree(item, dest, dirs_exist_ok=True)
            else:
                shutil.copy2(item, dest)
        subprocess.run(["git", "add", "."], cwd=repo_dir, check=True, capture_output=True)
        subprocess.run(["git", "commit", "-m", "Initial baseline commit"], cwd=repo_dir, check=True, capture_output=True)
        subprocess.run(["git", "branch", "-M", "baseline"], cwd=repo_dir, check=True, capture_output=True)

        # Breaking commit
        subprocess.run(["git", "checkout", "-b", "breaking"], cwd=repo_dir, check=True, capture_output=True)
        breaking_dir = settings.EXAMPLES_DIR / "breaking"
        for item in breaking_dir.iterdir():
            dest = repo_dir / item.name
            if item.is_dir():
                shutil.copytree(item, dest, dirs_exist_ok=True)
            else:
                shutil.copy2(item, dest)
        subprocess.run(["git", "add", "."], cwd=repo_dir, check=True, capture_output=True)
        subprocess.run(["git", "commit", "-m", "Breaking contract changes"], cwd=repo_dir, check=True, capture_output=True)
        subprocess.run(["git", "checkout", "baseline"], cwd=repo_dir, check=True, capture_output=True)

    yield repo_dir
