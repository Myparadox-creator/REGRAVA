"""
Safe Git reader for RepoSentinel.
Reads git revisions and file contents without executing repository code or modifying working tree.
"""

import os
import subprocess
from pathlib import Path
from typing import Dict, List, Optional, Tuple


class GitReaderError(Exception):
    """Base exception for Git operations."""
    pass


class InvalidRepositoryError(GitReaderError):
    """Raised when the path is not a valid git repository."""
    pass


class InvalidRevisionError(GitReaderError):
    """Raised when a revision ref cannot be resolved."""
    pass


class FileSizeLimitExceededError(GitReaderError):
    """Raised when a file exceeds the maximum allowed size."""
    pass


class ChangedFile:
    def __init__(self, path: str, status: str, old_path: Optional[str] = None):
        self.path = path.replace("\\", "/")
        self.status = status  # 'A', 'M', 'D', 'R', etc.
        self.old_path = old_path.replace("\\", "/") if old_path else None

    def __repr__(self) -> str:
        return f"<ChangedFile {self.status} {self.path}>"


class GitReader:
    def __init__(
        self,
        repo_path: Path,
        max_file_size: int = 1_048_576,
        timeout_seconds: int = 20,
    ):
        self.repo_path = Path(repo_path).resolve()
        self.max_file_size = max_file_size
        self.timeout = timeout_seconds
        self._validate_repository()

    def _run_git(self, args: List[str]) -> Tuple[int, str, str]:
        """Execute a git command using array arguments (no shell=True)."""
        cmd = ["git", "-C", str(self.repo_path)] + args
        try:
            res = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                encoding="utf-8",
                errors="replace",
                timeout=self.timeout,
                check=False,
            )
            return res.returncode, res.stdout, res.stderr
        except subprocess.TimeoutExpired:
            raise GitReaderError(f"Git command timed out after {self.timeout}s: {' '.join(args)}")
        except FileNotFoundError:
            raise GitReaderError("Git executable not found in system PATH.")
        except Exception as e:
            raise GitReaderError(f"Failed to execute git command: {str(e)}")

    def _validate_repository(self) -> None:
        """Verify the directory exists and is a git repository."""
        if not self.repo_path.exists() or not self.repo_path.is_dir():
            raise InvalidRepositoryError(f"Path does not exist or is not a directory: {self.repo_path}")

        code, stdout, stderr = self._run_git(["rev-parse", "--is-inside-work-tree"])
        if code != 0 or stdout.strip() != "true":
            raise InvalidRepositoryError(f"Directory is not a valid Git repository: {self.repo_path}")

    def verify_revision(self, ref: str) -> str:
        """Verify ref exists and resolve to full commit SHA."""
        if not ref or any(c in ref for c in [";", "&", "|", "`", "$", "\n", "\r", " "]):
            raise InvalidRevisionError(f"Invalid characters in revision ref: '{ref}'")

        code, stdout, stderr = self._run_git(["rev-parse", "--verify", f"{ref}^{{commit}}"])
        if code != 0:
            raise InvalidRevisionError(f"Revision '{ref}' does not exist or is not a commit in {self.repo_path}")
        return stdout.strip()

    def get_changed_files(self, base_ref: str, head_ref: str) -> List[ChangedFile]:
        """Get the list of changed files between base and head."""
        self.verify_revision(base_ref)
        self.verify_revision(head_ref)

        code, stdout, stderr = self._run_git([
            "diff",
            "--name-status",
            "-M",  # Detect renames
            base_ref,
            head_ref,
        ])
        if code != 0:
            raise GitReaderError(f"Failed to get changed files: {stderr}")

        changed_files: List[ChangedFile] = []
        for line in stdout.splitlines():
            line = line.strip()
            if not line:
                continue
            parts = line.split("\t")
            status_code = parts[0][0]  # First char of status: M, A, D, R
            if status_code == "R" and len(parts) >= 3:
                changed_files.append(ChangedFile(path=parts[2], status="R", old_path=parts[1]))
            elif len(parts) >= 2:
                changed_files.append(ChangedFile(path=parts[1], status=status_code))

        return changed_files

    def read_file_at_revision(self, ref: str, file_path: str) -> Optional[str]:
        """
        Read file contents at a specific revision without checking out.
        Returns None if file does not exist at that revision.
        """
        # Normalize relative path and prevent traversal
        norm_path = file_path.replace("\\", "/").lstrip("/")
        if ".." in norm_path.split("/"):
            raise GitReaderError(f"Path traversal detected in file path: {file_path}")

        # Check file size first using git cat-file -s
        code, size_out, _ = self._run_git(["cat-file", "-s", f"{ref}:{norm_path}"])
        if code != 0:
            return None  # File does not exist at this revision

        try:
            size = int(size_out.strip())
            if size > self.max_file_size:
                raise FileSizeLimitExceededError(
                    f"File '{norm_path}' size ({size} bytes) exceeds limit of {self.max_file_size} bytes"
                )
        except ValueError:
            pass

        # Read content via git show
        code, content, stderr = self._run_git(["show", f"{ref}:{norm_path}"])
        if code != 0:
            return None
        return content

    def list_files_at_revision(self, ref: str, extensions: Optional[List[str]] = None) -> List[str]:
        """List all tracked files at a revision, optionally filtered by extension."""
        self.verify_revision(ref)
        code, stdout, stderr = self._run_git(["ls-tree", "-r", "--name-only", ref])
        if code != 0:
            raise GitReaderError(f"Failed to list files at revision {ref}: {stderr}")

        files: List[str] = []
        for line in stdout.splitlines():
            p = line.strip().replace("\\", "/")
            if not p:
                continue
            if extensions:
                if any(p.endswith(ext) for ext in extensions):
                    files.append(p)
            else:
                files.append(p)
        return files
