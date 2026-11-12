"""
Pull Request Retrieval, Surrounding Context Discovery, and Unified Diff Line Mapper.
Retrieves full PR metadata, changed files (including renames), surrounding codebase context
for accurate security/contract evaluation, and maps findings strictly onto valid GitHub diff lines.
"""

from __future__ import annotations

import difflib
import logging
import re
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Set, Tuple
import httpx
from app.config import settings
from app.db.session_db import db
from app.services.github_app_service import GitHubAppError, github_app_auth
from app.services.github_service import DEMO_PULL_REQUESTS, DEMO_REPOSITORIES

logger = logging.getLogger(__name__)

_HUNK_HEADER_RE = re.compile(r"^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@")


@dataclass
class DiffFileMap:
    filename: str
    status: str
    previous_filename: Optional[str] = None
    right_lines: Set[int] = field(default_factory=set)
    left_lines: Set[int] = field(default_factory=set)
    added_lines: Set[int] = field(default_factory=set)
    deleted_lines: Set[int] = field(default_factory=set)
    patch: str = ""


@dataclass
class InlineDiffAnchor:
    path: str
    line: int
    side: str  # "RIGHT" or "LEFT"
    commit_id: str


def parse_unified_diff_patch(filename: str, patch: str, status: str = "modified", previous_filename: Optional[str] = None) -> DiffFileMap:
    """
    Parse a GitHub unified diff hunk string into valid GitHub inline comment line numbers.
    - RIGHT side: lines present in the new file inside any diff hunk (added '+' and context ' ').
    - LEFT side: lines deleted from the old file inside any diff hunk (deleted '-').
    """
    dmap = DiffFileMap(
        filename=filename,
        status=status,
        previous_filename=previous_filename,
        patch=patch or "",
    )
    if not patch:
        return dmap

    old_line = 0
    new_line = 0

    for raw_line in patch.splitlines():
        m = _HUNK_HEADER_RE.match(raw_line)
        if m:
            old_line = int(m.group(1))
            new_line = int(m.group(3))
            continue

        if raw_line.startswith("\\"):
            # "\ No newline at end of file"
            continue

        if raw_line.startswith("+"):
            dmap.right_lines.add(new_line)
            dmap.added_lines.add(new_line)
            new_line += 1
        elif raw_line.startswith("-"):
            dmap.left_lines.add(old_line)
            dmap.deleted_lines.add(old_line)
            old_line += 1
        else:
            # Context line present in both base and head within the hunk
            dmap.right_lines.add(new_line)
            dmap.left_lines.add(old_line)
            old_line += 1
            new_line += 1

    return dmap


def synthesize_unified_diff(filename: str, base_content: str, head_content: str) -> str:
    """Generate a unified diff patch between base and head text (used for demo dry-run diffs)."""
    base_lines = (base_content or "").splitlines(keepends=True)
    head_lines = (head_content or "").splitlines(keepends=True)
    diff_lines = list(
        difflib.unified_diff(
            base_lines,
            head_lines,
            fromfile=f"a/{filename}",
            tofile=f"b/{filename}",
            n=3,
        )
    )
    # Strip --- / +++ header lines to match GitHub's 'patch' field format
    body = [l.rstrip("\r\n") for l in diff_lines if not l.startswith(("--- ", "+++ "))]
    return "\n".join(body)


def map_finding_to_diff_location(
    diff_maps: Dict[str, DiffFileMap],
    file_path: Optional[str],
    line_number: Optional[int],
    head_sha: str,
    change_type: Optional[str] = None,
) -> Optional[InlineDiffAnchor]:
    """
    Validate and map a finding location onto a valid GitHub PR diff hunk.
    Returns None if the file or line cannot be anchored in the diff (never fabricates positions).
    """
    if not file_path or not line_number or line_number <= 0:
        return None

    norm_path = file_path.replace("\\", "/")
    dmap = diff_maps.get(norm_path)
    if not dmap:
        # Check if file was renamed
        for candidate in diff_maps.values():
            if candidate.previous_filename and candidate.previous_filename.replace("\\", "/") == norm_path:
                dmap = candidate
                break

    if not dmap or not dmap.patch:
        return None

    # For removed fields/routes where line number came from old_location in base file
    is_deletion = change_type in ("field_removed", "removed_route")
    if is_deletion:
        if line_number in dmap.deleted_lines or line_number in dmap.left_lines:
            return InlineDiffAnchor(path=dmap.filename, line=line_number, side="LEFT", commit_id=head_sha)
        # Fallback only if same line happens to be context/modified on RIGHT
        if line_number in dmap.right_lines:
            return InlineDiffAnchor(path=dmap.filename, line=line_number, side="RIGHT", commit_id=head_sha)
        return None

    # Standard finding in head file: must exist in right_lines of diff hunk
    if line_number in dmap.right_lines:
        return InlineDiffAnchor(path=dmap.filename, line=line_number, side="RIGHT", commit_id=head_sha)

    return None


class PullRequestDiffService:
    """Fetches authorized PR metadata, complete file diffs, and surrounding context."""

    GITHUB_API_BASE = "https://api.github.com"

    def verify_user_authorization(self, user_id: str, repo_full_name: str) -> Dict[str, Any]:
        """
        Enforce strict authorization rules:
        - User cannot use Google session alone to access GitHub repos.
        - Demo users are restricted exclusively to allowed demo repos.
        - Authenticated GitHub users can only access repos present in their authorized GitHub account.
        """
        user = db.get_user_by_id(user_id)
        if not user:
            raise PermissionError("User session not found.")

        is_demo_repo = any(r["full_name"].lower() == repo_full_name.lower() for r in DEMO_REPOSITORIES)
        account = db.get_github_account(user_id)

        if user.get("is_demo"):
            if not is_demo_repo:
                raise PermissionError(
                    f"Access denied: Demo session cannot review repository '{repo_full_name}'."
                )
            return {"mode": "demo", "account": account, "user": user}

        if not account:
            raise PermissionError(
                "GitHub repository authorization required. Connect your GitHub account before requesting a PR review."
            )

        if not db.check_repo_access(user_id, repo_full_name):
            raise PermissionError(
                f"Access denied: Your connected GitHub account does not have authorized access to '{repo_full_name}'."
            )

        return {"mode": "live", "account": account, "user": user}

    async def get_latest_pr_head_sha(
        self,
        owner: str,
        repo: str,
        pr_number: int,
        installation_id: Optional[str] = None,
        user_token: Optional[str] = None,
    ) -> Optional[str]:
        """Re-fetch the current head commit SHA right before publishing to avoid stale publications."""
        full_name = f"{owner}/{repo}"
        if any(r["full_name"].lower() == full_name.lower() for r in DEMO_REPOSITORIES):
            for p in DEMO_PULL_REQUESTS.get(full_name, []):
                if p["number"] == pr_number:
                    return p.get("head_sha", f"demo-{pr_number}-head")

        url = f"{self.GITHUB_API_BASE}/repos/{full_name}/pulls/{pr_number}"
        if installation_id and github_app_auth.is_configured():
            res = await github_app_auth.request_with_installation(installation_id, "GET", url)
            if res.status_code == 200:
                return res.json().get("head", {}).get("sha")
            return None

        if user_token and not user_token.startswith("demo"):
            async with httpx.AsyncClient(timeout=10.0) as client:
                res = await client.get(
                    url,
                    headers={"Authorization": f"Bearer {user_token}", "Accept": "application/vnd.github+json"},
                )
                if res.status_code == 200:
                    return res.json().get("head", {}).get("sha")
        return None

    async def fetch_pr_context(
        self,
        user_id: Optional[str],
        owner: str,
        repo: str,
        pr_number: int,
        installation_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Retrieve complete PR metadata, changed files (base + head + patch + renames),
        diff line anchor maps, and surrounding context files.
        """
        full_name = f"{owner}/{repo}"
        auth_ctx: Optional[Dict[str, Any]] = None
        if user_id:
            auth_ctx = self.verify_user_authorization(user_id, full_name)

        # 1. Handle Demo Repositories (when user is demo or repo is demo showcase)
        if any(r["full_name"].lower() == full_name.lower() for r in DEMO_REPOSITORIES):
            for p in DEMO_PULL_REQUESTS.get(full_name, []):
                if p["number"] == pr_number:
                    demo_files = []
                    diff_maps: Dict[str, DiffFileMap] = {}
                    for f in p.get("files", []):
                        fname = f["filename"].replace("\\", "/")
                        patch = f.get("patch") or synthesize_unified_diff(
                            fname, f.get("base_content", ""), f.get("head_content", "")
                        )
                        dmap = parse_unified_diff_patch(fname, patch, status=f.get("status", "modified"))
                        diff_maps[fname] = dmap
                        demo_files.append({
                            "filename": fname,
                            "previous_filename": f.get("previous_filename"),
                            "status": f.get("status", "modified"),
                            "base_content": f.get("base_content", ""),
                            "head_content": f.get("head_content", ""),
                            "patch": patch,
                            "additions": len(dmap.added_lines),
                            "deletions": len(dmap.deleted_lines),
                        })

                    head_sha = p.get("head_sha", f"demo-{pr_number}-sha-9f8e7d6")
                    base_sha = p.get("base_sha", "demo-base-sha-1a2b3c4")
                    return {
                        "repo_id": f"repo-demo-{repo}",
                        "repo_full_name": full_name,
                        "owner": owner,
                        "repo_name": repo,
                        "pr_number": pr_number,
                        "title": p["title"],
                        "description": p.get("description", ""),
                        "author": p.get("author", "developer"),
                        "author_avatar": p.get("author_avatar"),
                        "state": p.get("state", "open"),
                        "base_ref": p.get("base_ref", "main"),
                        "head_ref": p.get("head_ref", "HEAD"),
                        "base_sha": base_sha,
                        "head_sha": head_sha,
                        "html_url": f"https://github.com/{full_name}/pull/{pr_number}",
                        "changed_files_count": len(demo_files),
                        "additions": p.get("additions", 0),
                        "deletions": p.get("deletions", 0),
                        "files": demo_files,
                        "context_files": {},
                        "diff_maps": diff_maps,
                        "installation_id": None,
                        "is_demo": True,
                    }
            raise FileNotFoundError(f"Pull Request #{pr_number} not found in '{full_name}'.")

        # 2. Live GitHub Repository: Prefer GitHub App Installation Token
        resolved_inst_id = installation_id
        use_app_token = False
        user_token = None
        if auth_ctx and auth_ctx.get("account"):
            tok = auth_ctx["account"].get("access_token")
            if tok and not tok.startswith("demo"):
                user_token = tok

        if github_app_auth.is_configured():
            if not resolved_inst_id:
                inst = await github_app_auth.get_installation_for_repo(owner, repo)
                resolved_inst_id = str(inst["installation_id"])
            is_accessible = await github_app_auth.verify_repo_accessible_to_installation(
                resolved_inst_id, full_name
            )
            if not is_accessible:
                raise PermissionError(
                    f"Access denied: Repository '{full_name}' is not authorized in REGRAVA GitHub App installation."
                )
            use_app_token = True
        elif not user_token:
            raise GitHubAppError(
                "GitHub App credentials are not configured and no user GitHub token is available.",
                status_code=503,
            )

        async def _gh_get(url: str, accept: str = "application/vnd.github+json") -> httpx.Response:
            if use_app_token and resolved_inst_id:
                return await github_app_auth.request_with_installation(
                    resolved_inst_id, "GET", url, extra_headers={"Accept": accept}
                )
            async with httpx.AsyncClient(timeout=15.0) as client:
                return await client.get(
                    url,
                    headers={
                        "Authorization": f"Bearer {user_token}",
                        "Accept": accept,
                        "X-GitHub-Api-Version": "2022-11-28",
                    },
                )

        # Fetch PR metadata
        pr_res = await _gh_get(f"{self.GITHUB_API_BASE}/repos/{full_name}/pulls/{pr_number}")
        if pr_res.status_code == 404:
            raise FileNotFoundError(f"Pull Request #{pr_number} in '{full_name}' was not found or is inaccessible.")
        if pr_res.status_code == 403:
            raise PermissionError(f"GitHub App lacks permission to read '{full_name}' PR #{pr_number}.")
        if pr_res.status_code != 200:
            raise GitHubAppError(
                f"Failed to retrieve PR #{pr_number} from GitHub (HTTP {pr_res.status_code}).",
                status_code=pr_res.status_code,
            )

        pr_data = pr_res.json()
        base_sha = pr_data.get("base", {}).get("sha", "")
        head_sha = pr_data.get("head", {}).get("sha", "")
        repo_obj = pr_data.get("base", {}).get("repo", {})
        repo_id = str(repo_obj.get("id", "")) if repo_obj.get("id") is not None else None

        # Paginated fetch of PR changed files (up to settings.MAX_DIFF_FILES)
        files_data: List[Dict[str, Any]] = []
        page = 1
        while len(files_data) < settings.MAX_DIFF_FILES:
            files_res = await _gh_get(
                f"{self.GITHUB_API_BASE}/repos/{full_name}/pulls/{pr_number}/files?per_page=100&page={page}"
            )
            if files_res.status_code != 200:
                break
            batch = files_res.json()
            if not batch:
                break
            files_data.extend(batch)
            if len(batch) < 100:
                break
            page += 1
        files_data = files_data[: settings.MAX_DIFF_FILES]

        parsed_files: List[Dict[str, Any]] = []
        diff_maps: Dict[str, DiffFileMap] = {}
        changed_filenames: Set[str] = set()

        for f in files_data:
            fname = f.get("filename", "").replace("\\", "/")
            prev_fname = f.get("previous_filename")
            if prev_fname:
                prev_fname = prev_fname.replace("\\", "/")
            status = f.get("status", "modified")
            patch = f.get("patch", "")
            changed_filenames.add(fname)

            dmap = parse_unified_diff_patch(fname, patch, status=status, previous_filename=prev_fname)
            diff_maps[fname] = dmap

            head_content = ""
            if head_sha and status != "removed":
                head_res = await _gh_get(
                    f"{self.GITHUB_API_BASE}/repos/{full_name}/contents/{fname}?ref={head_sha}",
                    accept="application/vnd.github.raw+json",
                )
                if head_res.status_code == 200 and len(head_res.content) <= settings.MAX_FILE_SIZE_BYTES:
                    head_content = head_res.text

            base_content = ""
            base_lookup_name = prev_fname or fname
            if base_sha and status in ("modified", "removed", "renamed"):
                base_res = await _gh_get(
                    f"{self.GITHUB_API_BASE}/repos/{full_name}/contents/{base_lookup_name}?ref={base_sha}",
                    accept="application/vnd.github.raw+json",
                )
                if base_res.status_code == 200 and len(base_res.content) <= settings.MAX_FILE_SIZE_BYTES:
                    base_content = base_res.text

            parsed_files.append({
                "filename": fname,
                "previous_filename": prev_fname,
                "status": status,
                "base_content": base_content,
                "head_content": head_content,
                "patch": patch,
                "additions": f.get("additions", len(dmap.added_lines)),
                "deletions": f.get("deletions", len(dmap.deleted_lines)),
            })

        # Fetch relevant surrounding context files (auth middleware, deps, tests, TS consumers)
        context_files = await self._fetch_surrounding_context(
            full_name=full_name,
            head_sha=head_sha,
            already_fetched=changed_filenames,
            gh_get=_gh_get,
        )

        return {
            "repo_id": repo_id,
            "repo_full_name": full_name,
            "owner": owner,
            "repo_name": repo,
            "pr_number": pr_number,
            "title": pr_data.get("title", f"PR #{pr_number}"),
            "description": pr_data.get("body") or "",
            "author": pr_data.get("user", {}).get("login", "unknown"),
            "author_avatar": pr_data.get("user", {}).get("avatar_url"),
            "state": pr_data.get("state", "open"),
            "base_ref": pr_data.get("base", {}).get("ref", "main"),
            "head_ref": pr_data.get("head", {}).get("ref", "HEAD"),
            "base_sha": base_sha,
            "head_sha": head_sha,
            "html_url": pr_data.get("html_url") or f"https://github.com/{full_name}/pull/{pr_number}",
            "changed_files_count": len(parsed_files),
            "additions": pr_data.get("additions", 0),
            "deletions": pr_data.get("deletions", 0),
            "files": parsed_files,
            "context_files": context_files,
            "diff_maps": diff_maps,
            "installation_id": resolved_inst_id,
            "is_demo": False,
        }

    async def _fetch_surrounding_context(
        self,
        full_name: str,
        head_sha: str,
        already_fetched: Set[str],
        gh_get: Any,
        max_context_files: int = 18,
    ) -> Dict[str, str]:
        """
        Retrieve relevant surrounding files (middleware, auth dependencies, schemas, frontend
        API consumers, and test suites) so static checks evaluate full context rather than
        relying solely on changed lines.
        """
        context: Dict[str, str] = {}
        if not head_sha:
            return context

        try:
            tree_res = await gh_get(f"{self.GITHUB_API_BASE}/repos/{full_name}/git/trees/{head_sha}?recursive=1")
            if tree_res.status_code != 200:
                return context
            tree_items = tree_res.json().get("tree", [])
        except Exception:
            return context

        candidates: List[Tuple[int, str]] = []
        for item in tree_items:
            if item.get("type") != "blob":
                continue
            path = item.get("path", "").replace("\\", "/")
            if not path or path in already_fetched:
                continue
            if any(seg in path for seg in ("node_modules/", ".venv/", "dist/", "build/", "__pycache__/")):
                continue
            if item.get("size", 0) > settings.MAX_FILE_SIZE_BYTES:
                continue

            lower = path.lower()
            priority = 99
            if any(k in lower for k in ("auth", "middleware", "deps", "dependencies", "security", "main.py", "app.py")):
                if lower.endswith(".py"):
                    priority = 1
            elif lower.endswith(".py") and ("test_" in lower or "_test.py" in lower or "/tests/" in lower):
                priority = 2
            elif lower.endswith((".ts", ".tsx")) and any(k in lower for k in ("api", "client", "service", "types")):
                priority = 3
            elif lower.endswith((".ts", ".tsx")) and (".test." in lower or ".spec." in lower):
                priority = 4

            if priority < 99:
                candidates.append((priority, path))

        candidates.sort(key=lambda x: (x[0], x[1]))
        for _, path in candidates[:max_context_files]:
            try:
                res = await gh_get(
                    f"{self.GITHUB_API_BASE}/repos/{full_name}/contents/{path}?ref={head_sha}",
                    accept="application/vnd.github.raw+json",
                )
                if res.status_code == 200 and len(res.content) <= settings.MAX_FILE_SIZE_BYTES:
                    context[path] = res.text
            except Exception:
                continue

        return context


pr_diff_service = PullRequestDiffService()
