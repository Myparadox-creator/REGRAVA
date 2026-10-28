"""
Unit tests for GitReader module.
"""

import pytest
from pathlib import Path
from app.analyzer.git_reader import (
    GitReader,
    InvalidRepositoryError,
    InvalidRevisionError,
    GitReaderError,
)
from app.config import settings


def test_invalid_repository_path(tmp_path):
    with pytest.raises(InvalidRepositoryError):
        GitReader(tmp_path)


def test_valid_git_repository():
    demo_git = settings.EXAMPLES_DIR / "git_repo"
    reader = GitReader(demo_git)
    assert reader.repo_path == demo_git.resolve()


def test_verify_revision():
    demo_git = settings.EXAMPLES_DIR / "git_repo"
    reader = GitReader(demo_git)
    sha = reader.verify_revision("baseline")
    assert len(sha) == 40


def test_verify_invalid_revision():
    demo_git = settings.EXAMPLES_DIR / "git_repo"
    reader = GitReader(demo_git)
    with pytest.raises(InvalidRevisionError):
        reader.verify_revision("non_existent_branch_123")


def test_get_changed_files():
    demo_git = settings.EXAMPLES_DIR / "git_repo"
    reader = GitReader(demo_git)
    changes = reader.get_changed_files("baseline", "breaking")
    changed_paths = [c.path for c in changes]
    assert any("models.py" in p for p in changed_paths)


def test_read_file_at_revision():
    demo_git = settings.EXAMPLES_DIR / "git_repo"
    reader = GitReader(demo_git)
    content_base = reader.read_file_at_revision("baseline", "backend/models.py")
    assert content_base is not None
    assert "user_id: int" in content_base

    content_breaking = reader.read_file_at_revision("breaking", "backend/models.py")
    assert content_breaking is not None
    assert "id: int" in content_breaking
    assert "user_id" not in content_breaking


def test_path_traversal_prevention():
    demo_git = settings.EXAMPLES_DIR / "git_repo"
    reader = GitReader(demo_git)
    with pytest.raises(GitReaderError):
        reader.read_file_at_revision("baseline", "../../etc/passwd")
