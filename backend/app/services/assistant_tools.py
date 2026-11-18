"""
Controlled Read-Only Repository Tools for REGRAVA AI Assistant.
Provides strictly read-only inspection of authorized GitHub repositories,
pull request diffs, security findings, and test evidence with secret scrubbing.
"""

import json
import re
from typing import Dict, List, Optional, Any
import httpx
from app.config import settings
from app.db.session_db import db
from app.services.github_service import github_service, DEMO_REPOSITORIES, DEMO_PULL_REQUESTS


# Regex patterns to scrub sensitive credentials from code outputs
SECRET_PATTERNS = [
    re.compile(r"sk[-_](?:live|test)[-_][0-9a-zA-Z]{24,}", re.IGNORECASE),
    re.compile(r"gh[pousr]_[0-9a-zA-Z]{36,}", re.IGNORECASE),
    re.compile(r"-----BEGIN (?:RSA )?PRIVATE KEY-----[\s\S]*?-----END (?:RSA )?PRIVATE KEY-----"),
    re.compile(r"(?:api[_-]?key|secret|password|bearer|auth[_-]?token)\s*[:=]\s*['\"]([^'\"]{8,})['\"]", re.IGNORECASE),
]


def scrub_secrets(text: str) -> str:
    """Mask credentials and private keys in any string before returning to LLM or user."""
    if not text:
        return ""
    result = text
    for pattern in SECRET_PATTERNS:
        result = pattern.sub("[REDACTED_SECRET]", result)
    return result


class AssistantTools:
    """Safe, read-only tools exposed to the AI Assistant."""

    @staticmethod
    def _verify_authorization(user_id: str, repo_full_name: str) -> None:
        """Enforce strict per-user authorization boundaries."""
        if not repo_full_name:
            raise ValueError("Repository full name is required.")
        # Check demo repos
        if any(r["full_name"].lower() == repo_full_name.lower() for r in DEMO_REPOSITORIES):
            return
        # Check user database access
        if not db.check_repo_access(user_id, repo_full_name):
            raise PermissionError(f"Access denied: User is not authorized to access '{repo_full_name}'.")

    @classmethod
    async def get_repository_overview(cls, user_id: str, repo_full_name: str) -> Dict[str, Any]:
        """Retrieve repository metadata, default branch, language, and README excerpt."""
        cls._verify_authorization(user_id, repo_full_name)

        # Check demo repos
        for demo in DEMO_REPOSITORIES:
            if demo["full_name"].lower() == repo_full_name.lower():
                return {
                    "full_name": demo["full_name"],
                    "description": demo.get("description", ""),
                    "default_branch": demo.get("default_branch", "main"),
                    "is_private": demo.get("is_private", True),
                    "open_prs_count": demo.get("open_pull_requests_count", 0),
                    "readme_excerpt": f"# {demo['name']}\n{demo.get('description', '')}\nProvides core services and API routes.",
                }

        # Real GitHub API
        account = db.get_github_account(user_id)
        token = (account.get("access_token") if account else None) or settings.GITHUB_TOKEN
        if not token:
            raise PermissionError("No GitHub token available to query repository.")

        async with httpx.AsyncClient(timeout=10.0) as client:
            res = await client.get(
                f"https://api.github.com/repos/{repo_full_name}",
                headers={"Authorization": f"Bearer {token}", "Accept": "application/vnd.github.v3+json"},
            )
            if res.status_code != 200:
                raise FileNotFoundError(f"Repository '{repo_full_name}' not found on GitHub.")
            data = res.json()

            readme_excerpt = ""
            try:
                readme_res = await client.get(
                    f"https://api.github.com/repos/{repo_full_name}/readme",
                    headers={"Authorization": f"Bearer {token}", "Accept": "application/vnd.github.v3.raw"},
                )
                if readme_res.status_code == 200:
                    readme_excerpt = scrub_secrets(readme_res.text[:1500])
            except Exception:
                pass

            return {
                "full_name": data.get("full_name"),
                "description": data.get("description") or "No description provided",
                "default_branch": data.get("default_branch", "main"),
                "is_private": data.get("private", False),
                "open_prs_count": data.get("open_issues_count", 0),
                "language": data.get("language", "Unknown"),
                "readme_excerpt": readme_excerpt,
            }

    @classmethod
    async def list_repository_files(
        cls, user_id: str, repo_full_name: str, path: str = ""
    ) -> List[Dict[str, Any]]:
        """List files and directories in repository tree."""
        cls._verify_authorization(user_id, repo_full_name)

        # Demo repos return standard microservice structure
        if any(r["full_name"].lower() == repo_full_name.lower() for r in DEMO_REPOSITORIES):
            if "payment" in repo_full_name.lower():
                return [
                    {"path": "backend/routes/payment.py", "type": "file", "size": 1024},
                    {"path": "backend/models.py", "type": "file", "size": 512},
                    {"path": "services/payments/PaymentView.tsx", "type": "file", "size": 1400},
                    {"path": "tests/test_payment.py", "type": "file", "size": 800},
                    {"path": "README.md", "type": "file", "size": 350},
                ]
            else:
                return [
                    {"path": "backend/routes/users.py", "type": "file", "size": 950},
                    {"path": "backend/models/user.py", "type": "file", "size": 600},
                    {"path": "frontend/src/components/UserProfile.tsx", "type": "file", "size": 1200},
                    {"path": "README.md", "type": "file", "size": 400},
                ]

        account = db.get_github_account(user_id)
        token = (account.get("access_token") if account else None) or settings.GITHUB_TOKEN
        if not token:
            return []

        async with httpx.AsyncClient(timeout=10.0) as client:
            res = await client.get(
                f"https://api.github.com/repos/{repo_full_name}/contents/{path.strip('/')}",
                headers={"Authorization": f"Bearer {token}", "Accept": "application/vnd.github.v3+json"},
            )
            if res.status_code == 200:
                items = res.json()
                if isinstance(items, list):
                    return [
                        {
                            "path": item.get("path", ""),
                            "name": item.get("name", ""),
                            "type": item.get("type", "file"),
                            "size": item.get("size", 0),
                        }
                        for item in items[:50]
                    ]
        return []

    @classmethod
    async def search_repository_code(
        cls, user_id: str, repo_full_name: str, query: str
    ) -> List[Dict[str, Any]]:
        """Search repository source files for matching symbols, routes, or code patterns."""
        cls._verify_authorization(user_id, repo_full_name)
        cleaned_query = query.strip()
        if not cleaned_query:
            return []

        # Check demo repos
        if repo_full_name in DEMO_PULL_REQUESTS:
            results = []
            for pr in DEMO_PULL_REQUESTS[repo_full_name]:
                for f in pr.get("files", []):
                    head = f.get("head_content", "")
                    if cleaned_query.lower() in head.lower():
                        results.append({
                            "path": f["filename"],
                            "matches": [f"Contains query '{cleaned_query}'"],
                            "preview": head[:300],
                        })
            return results

        account = db.get_github_account(user_id)
        token = (account.get("access_token") if account else None) or settings.GITHUB_TOKEN
        if not token:
            return []

        async with httpx.AsyncClient(timeout=12.0) as client:
            res = await client.get(
                f"https://api.github.com/search/code?q={cleaned_query}+repo:{repo_full_name}",
                headers={"Authorization": f"Bearer {token}", "Accept": "application/vnd.github.v3+json"},
            )
            if res.status_code == 200:
                items = res.json().get("items", [])
                return [
                    {
                        "path": item.get("path"),
                        "name": item.get("name"),
                        "html_url": item.get("html_url"),
                    }
                    for item in items[:10]
                ]
        return []

    @classmethod
    async def read_source_file(
        cls, user_id: str, repo_full_name: str, file_path: str, ref: str = "main", max_lines: int = 150
    ) -> Dict[str, Any]:
        """Read repository source file at a given ref/commit with numbered lines and secret scrubbing."""
        cls._verify_authorization(user_id, repo_full_name)
        clean_path = file_path.strip().lstrip("/")

        # Check demo data
        if repo_full_name in DEMO_PULL_REQUESTS:
            for pr in DEMO_PULL_REQUESTS[repo_full_name]:
                for f in pr.get("files", []):
                    if f["filename"] == clean_path:
                        raw_content = f.get("head_content") or f.get("base_content") or ""
                        lines = raw_content.splitlines()[:max_lines]
                        numbered = "\n".join(f"{i+1:4d} | {line}" for i, line in enumerate(lines))
                        return {
                            "path": clean_path,
                            "ref": ref,
                            "total_lines": len(raw_content.splitlines()),
                            "content": scrub_secrets(numbered),
                        }

        # Check local files if in demo project
        if "payment" in repo_full_name.lower():
            p_view = settings.PROJECT_ROOT / clean_path
            if p_view.exists() and p_view.is_file():
                raw = p_view.read_text(encoding="utf-8")
                lines = raw.splitlines()[:max_lines]
                numbered = "\n".join(f"{i+1:4d} | {line}" for i, line in enumerate(lines))
                return {
                    "path": clean_path,
                    "ref": ref,
                    "total_lines": len(raw.splitlines()),
                    "content": scrub_secrets(numbered),
                }

        # Real GitHub API lookup
        account = db.get_github_account(user_id)
        token = (account.get("access_token") if account else None) or settings.GITHUB_TOKEN
        if not token:
            raise FileNotFoundError(f"Source file '{clean_path}' could not be read.")

        async with httpx.AsyncClient(timeout=10.0) as client:
            res = await client.get(
                f"https://api.github.com/repos/{repo_full_name}/contents/{clean_path}?ref={ref}",
                headers={"Authorization": f"Bearer {token}", "Accept": "application/vnd.github.v3.raw"},
            )
            if res.status_code == 200:
                raw = res.text
                lines = raw.splitlines()[:max_lines]
                numbered = "\n".join(f"{i+1:4d} | {line}" for i, line in enumerate(lines))
                return {
                    "path": clean_path,
                    "ref": ref,
                    "total_lines": len(raw.splitlines()),
                    "content": scrub_secrets(numbered),
                }

        raise FileNotFoundError(f"File '{clean_path}' not found at revision '{ref}'.")

    @classmethod
    async def get_pull_request_details(
        cls, user_id: str, repo_full_name: str, pr_number: int
    ) -> Dict[str, Any]:
        """Retrieve Pull Request metadata, branch names, author, and changed files."""
        cls._verify_authorization(user_id, repo_full_name)
        pr_info = await github_service.get_pull_request_files(user_id, repo_full_name, pr_number)
        return {
            "number": pr_info.get("number"),
            "title": pr_info.get("title"),
            "author": pr_info.get("author"),
            "state": pr_info.get("state"),
            "base_ref": pr_info.get("base_ref"),
            "head_ref": pr_info.get("head_ref"),
            "changed_files_count": pr_info.get("changed_files_count", 0),
            "additions": pr_info.get("additions", 0),
            "deletions": pr_info.get("deletions", 0),
            "files": [f["filename"] for f in pr_info.get("files", [])],
        }

    @classmethod
    async def get_pull_request_diff(
        cls, user_id: str, repo_full_name: str, pr_number: int
    ) -> Dict[str, Any]:
        """Retrieve unified diff summary and file patches for a pull request."""
        cls._verify_authorization(user_id, repo_full_name)
        pr_info = await github_service.get_pull_request_files(user_id, repo_full_name, pr_number)
        diff_summaries = []
        for f in pr_info.get("files", []):
            patch = f.get("patch", "")
            if not patch and (f.get("base_content") or f.get("head_content")):
                patch = f"Modified: {f['filename']} (lines modified)"
            diff_summaries.append({
                "filename": f["filename"],
                "status": f.get("status", "modified"),
                "patch": scrub_secrets(patch[:1200]),
            })
        return {
            "pr_number": pr_number,
            "total_files": len(diff_summaries),
            "diffs": diff_summaries,
        }

    @classmethod
    def get_security_findings(
        cls, user_id: str, repo_full_name: str, pr_number: Optional[int] = None
    ) -> List[Dict[str, Any]]:
        """Retrieve AST findings and lifecycle records for a repository or PR."""
        cls._verify_authorization(user_id, repo_full_name)

        findings = []
        if pr_number:
            lifecycle_records = db.list_finding_lifecycle_for_pr(repo_full_name, pr_number)
            if lifecycle_records:
                for r in lifecycle_records:
                    findings.append({
                        "id": r["finding_id"],
                        "title": r["title"],
                        "severity": r["severity"],
                        "confidence": r["confidence"],
                        "category": r["category"],
                        "file_path": r.get("file_path"),
                        "line_number": r.get("line_number"),
                        "lifecycle_status": r.get("current_status", "Open"),
                        "evidence": r.get("evidence", []),
                    })
                return findings

        # Also check historical pr_analyses
        history = db.list_pr_analyses(user_id, repo_full_name, limit=10)
        for h in history:
            full = db.get_pr_analysis(h["id"])
            if full and "findings" in full:
                for f in full["findings"]:
                    findings.append({
                        "id": f.get("id"),
                        "title": f.get("title"),
                        "severity": f.get("severity"),
                        "confidence": f.get("confidence"),
                        "category": f.get("category"),
                        "file_path": f.get("changed_file", {}).get("path") if isinstance(f.get("changed_file"), dict) else None,
                        "line_number": f.get("changed_file", {}).get("line") if isinstance(f.get("changed_file"), dict) else None,
                        "summary": f.get("summary"),
                        "remediation": f.get("remediation"),
                        "lifecycle_status": "Open",
                    })
        return findings

    @classmethod
    def get_finding_details(
        cls, user_id: str, finding_id: str, analysis_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """Retrieve specific finding details, remediation advice, and current resolution status."""
        # 1. Search in finding_lifecycle table
        with db._get_connection() as conn:
            row = conn.execute(
                "SELECT * FROM finding_lifecycle WHERE finding_id = ? ORDER BY last_seen_at DESC LIMIT 1",
                (finding_id,),
            ).fetchone()
            if row:
                hydrated = db._hydrate_lifecycle(row)
                cls._verify_authorization(user_id, hydrated["repo_full_name"])
                return hydrated

        # 2. Search in pr_analyses table
        if analysis_id:
            analysis = db.get_pr_analysis(analysis_id)
            if analysis and "findings" in analysis:
                cls._verify_authorization(user_id, analysis["repo_name"])
                for f in analysis["findings"]:
                    if f.get("id") == finding_id:
                        return f

        # Fallback search across user's pr_analyses
        all_analyses = db.list_pr_analyses(user_id, limit=20)
        for a in all_analyses:
            full = db.get_pr_analysis(a["id"])
            if full and "findings" in full:
                for f in full["findings"]:
                    if f.get("id") == finding_id:
                        return f

        raise FileNotFoundError(f"Finding '{finding_id}' not found.")

    @classmethod
    def get_test_evidence(
        cls, user_id: str, repo_full_name: str, pr_number: int
    ) -> Dict[str, Any]:
        """Retrieve test evidence and verification status for PR changes."""
        cls._verify_authorization(user_id, repo_full_name)
        # Search for recent analysis
        with db._get_connection() as conn:
            row = conn.execute(
                "SELECT * FROM pr_analyses WHERE LOWER(repo_name) = LOWER(?) AND pr_number = ? "
                "ORDER BY created_at DESC LIMIT 1",
                (repo_full_name, pr_number),
            ).fetchone()
            if row:
                summary_data = json.loads(row["summary_json"] or "{}")
                return {
                    "pr_number": pr_number,
                    "repo_name": repo_full_name,
                    "has_test_evidence": summary_data.get("has_tests", False),
                    "test_files": summary_data.get("test_files", []),
                    "ci_status": summary_data.get("ci_status", "Not configured"),
                    "verification_summary": summary_data.get("test_summary", "AST verification completed."),
                }

        return {
            "pr_number": pr_number,
            "repo_name": repo_full_name,
            "has_test_evidence": False,
            "test_files": [],
            "ci_status": "No CI test runs recorded",
            "verification_summary": "No verified test execution evidence found for this PR revision.",
        }

    @classmethod
    def compare_analysis_revisions(
        cls, user_id: str, repo_full_name: str, pr_number: int
    ) -> List[Dict[str, Any]]:
        """Track how findings evolved across revisions of the pull request."""
        cls._verify_authorization(user_id, repo_full_name)
        records = db.list_finding_lifecycle_for_pr(repo_full_name, pr_number)
        return [
            {
                "finding_id": r["finding_id"],
                "title": r["title"],
                "severity": r["severity"],
                "original_sha": r["original_head_sha"][:7],
                "current_sha": r["current_head_sha"][:7],
                "status": r["current_status"],
                "previous_status": r.get("previous_status"),
                "notes": r.get("resolution_notes"),
            }
            for r in records
        ]
