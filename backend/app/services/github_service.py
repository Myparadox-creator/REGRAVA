"""
GitHub Integration Service for REGRAVA.
Supports real GitHub App API integration (fetching authorized repositories, PRs, and diffs)
along with deterministic local demo repositories for zero-credential exploration.
"""

from typing import Dict, List, Optional, Any
import httpx
from app.config import settings
from app.db.session_db import db


DEMO_REPOSITORIES = [
    {
        "id": "repo-demo-1",
        "name": "payment-service",
        "full_name": "demo-org/payment-service",
        "owner": "demo-org",
        "description": "Production payment processing and checkout microservice.",
        "is_private": True,
        "default_branch": "main",
        "open_pull_requests_count": 2,
        "updated_at": "2026-10-28T12:00:00Z",
    },
    {
        "id": "repo-demo-2",
        "name": "user-service",
        "full_name": "demo-org/user-service",
        "owner": "demo-org",
        "description": "User identity, profile management, and session API.",
        "is_private": False,
        "default_branch": "main",
        "open_pull_requests_count": 1,
        "updated_at": "2026-10-28T14:30:00Z",
    },
]

DEMO_PULL_REQUESTS: Dict[str, List[Dict[str, Any]]] = {
    "demo-org/payment-service": [
        {
            "number": 42,
            "title": "feat: Add direct checkout endpoint and fast receipt generator",
            "author": "dev-aditya",
            "author_avatar": "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&auto=format&fit=crop&q=80",
            "state": "open",
            "base_ref": "main",
            "head_ref": "feature/direct-checkout",
            "created_at": "2026-10-28T10:15:00Z",
            "changed_files_count": 4,
            "additions": 48,
            "deletions": 12,
            "files": [
                {
                    "filename": "backend/routes/payment.py",
                    "status": "modified",
                    "base_content": """
from fastapi import FastAPI, Depends
from pydantic import BaseModel
from ..models import PaymentResponse

app = FastAPI()

@app.get("/api/payments/{payment_id}", response_model=PaymentResponse)
def get_payment(payment_id: int):
    # Safe parameterized lookup
    return PaymentResponse(payment_id=payment_id, amount=99.0, payment_token="tok_12345")
""",
                    "head_content": """
import os
from fastapi import FastAPI
from pydantic import BaseModel
from ..models import PaymentResponse

app = FastAPI()

# Hardcoded payment gateway secret
STRIPE_SECRET_KEY = "sk-live-a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6"

@app.get("/api/payments/{payment_id}", response_model=PaymentResponse)
def get_payment(payment_id: int):
    # Insecure SQL query formatting
    query = f"SELECT * FROM transactions WHERE payment_id = '{payment_id}'"
    return PaymentResponse(payment_id=payment_id, amount=99.0, checkout_id="chk_999")

@app.get("/api/receipts/download")
def download_receipt(filename: str):
    # Potential path traversal
    file_path = f"/var/receipts/{filename}"
    with open(file_path, "r") as f:
        return {"receipt": f.read()}
""",
                },
                {
                    "filename": "backend/models.py",
                    "status": "modified",
                    "base_content": """
from pydantic import BaseModel

class PaymentResponse(BaseModel):
    payment_id: int
    amount: float
    payment_token: str
""",
                    "head_content": """
from pydantic import BaseModel

class PaymentResponse(BaseModel):
    payment_id: int
    amount: float
    checkout_id: str
""",
                },
                {
                    "filename": "frontend/src/Checkout.tsx",
                    "status": "modified",
                    "base_content": """
import React, { useEffect, useState } from "react";

export const Checkout = ({ paymentId }: { paymentId: number }) => {
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    fetch(`/api/payments/${paymentId}`)
      .then((res) => res.json())
      .then((resData) => setData(resData));
  }, [paymentId]);

  if (!data) return <div>Loading...</div>;

  const token = data.payment_token;
  return <div>Payment Token: {token}</div>;
};
""",
                    "head_content": """
import React, { useEffect, useState } from "react";

export const Checkout = ({ paymentId }: { paymentId: number }) => {
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    fetch(`/api/payments/${paymentId}`)
      .then((res) => res.json())
      .then((resData) => setData(resData));
  }, [paymentId]);

  if (!data) return <div>Loading...</div>;

  // Breaking regression: backend removed 'payment_token'
  const token = data.payment_token;
  return (
    <div>
      <div>Payment Token: {token}</div>
      <div dangerouslySetInnerHTML={{ __html: "<p>Receipt Verified</p>" }} />
    </div>
  );
};
""",
                },
            ],
        },
        {
            "number": 43,
            "title": "fix: Harden input validation and sanitize file paths",
            "author": "sarah-sec",
            "author_avatar": "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&auto=format&fit=crop&q=80",
            "state": "open",
            "base_ref": "main",
            "head_ref": "fix/security-hardening",
            "created_at": "2026-10-28T11:45:00Z",
            "changed_files_count": 2,
            "additions": 22,
            "deletions": 8,
            "files": [
                {
                    "filename": "backend/routes/payment.py",
                    "status": "modified",
                    "base_content": "def download(path): open(path)",
                    "head_content": "def download(path): # Confinement check\n  clean_path = Path(path).resolve()\n  if not clean_path.is_relative_to(BASE): raise ValueError('Denied')",
                }
            ],
        },
    ],
    "demo-org/user-service": [
        {
            "number": 108,
            "title": "feat: Allow custom avatar proxy URL in user profiles",
            "author": "marcus-dev",
            "author_avatar": "https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=100&auto=format&fit=crop&q=80",
            "state": "open",
            "base_ref": "main",
            "head_ref": "feat/avatar-proxy",
            "created_at": "2026-10-28T09:00:00Z",
            "changed_files_count": 2,
            "additions": 18,
            "deletions": 3,
            "files": [
                {
                    "filename": "backend/routes/avatar.py",
                    "status": "modified",
                    "base_content": """
from fastapi import FastAPI
app = FastAPI()
""",
                    "head_content": """
import httpx
from fastapi import FastAPI

app = FastAPI()

@app.get("/api/users/{user_id}/avatar-proxy")
async def proxy_avatar(user_id: int, avatar_url: str):
    # Potential Server-Side Request Forgery (SSRF)
    async with httpx.AsyncClient() as client:
        res = await client.get(avatar_url)
        return {"avatar_bytes": len(res.content)}
""",
                }
            ],
        }
    ],
}


class GitHubService:
    def __init__(self):
        self.client_id = settings.GITHUB_CLIENT_ID
        self.client_secret = settings.GITHUB_CLIENT_SECRET

    async def list_authorized_repositories(self, user_id: str) -> List[Dict[str, Any]]:
        """
        List repositories that the user has explicitly authorized REGRAVA to access.
        Uses real GitHub API when user has a connected live GitHub account,
        or demo repository list for demo users and unconfigured environments.
        """
        account = db.get_github_account(user_id)
        access_token = (account.get("access_token") if account else None) or settings.GITHUB_TOKEN
        if not access_token:
            return DEMO_REPOSITORIES
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                res = await client.get(
                    "https://api.github.com/user/repos?per_page=100&sort=updated",
                    headers={
                        "Authorization": f"Bearer {access_token}",
                        "Accept": "application/vnd.github.v3+json",
                    },
                )
                if res.status_code == 200:
                    repos_data = res.json()
                    authorized_names = set(account.get("authorized_repos", []))
                    matched_repos = []
                    for r in repos_data:
                        full_name = r.get("full_name", "")
                        if not authorized_names or full_name in authorized_names or bool(access_token):
                            matched_repos.append({
                                "id": str(r["id"]),
                                "name": r["name"],
                                "full_name": full_name,
                                "owner": r["owner"]["login"],
                                "description": r.get("description") or "No description provided",
                                "is_private": r.get("private", False),
                                "default_branch": r.get("default_branch", "main"),
                                "open_pull_requests_count": r.get("open_issues_count", 0),
                                "updated_at": r.get("updated_at", ""),
                            })
                    return matched_repos if matched_repos else DEMO_REPOSITORIES
        except Exception:
            pass

        return DEMO_REPOSITORIES

    async def list_pull_requests(self, user_id: str, repo_full_name: str) -> List[Dict[str, Any]]:
        """Fetch open pull requests for a repository."""
        # 1. Check if authorized
        if not db.check_repo_access(user_id, repo_full_name):
            # If repo is in demo list, permit
            if not any(r["full_name"] == repo_full_name for r in DEMO_REPOSITORIES):
                raise PermissionError(f"Access denied: You are not authorized to access '{repo_full_name}'.")

        # 2. Check demo data first
        if repo_full_name in DEMO_PULL_REQUESTS:
            return DEMO_PULL_REQUESTS[repo_full_name]

        # 3. Real GitHub API
        account = db.get_github_account(user_id)
        access_token = (account.get("access_token") if account else None) or settings.GITHUB_TOKEN
        if access_token:
            try:
                async with httpx.AsyncClient(timeout=10.0) as client:
                    res = await client.get(
                        f"https://api.github.com/repos/{repo_full_name}/pulls?state=open&per_page=30",
                        headers={
                            "Authorization": f"Bearer {access_token}",
                            "Accept": "application/vnd.github.v3+json",
                        },
                    )
                    if res.status_code == 200:
                        pr_list = []
                        for p in res.json():
                            pr_list.append({
                                "number": p["number"],
                                "title": p["title"],
                                "author": p["user"]["login"],
                                "author_avatar": p["user"]["avatar_url"],
                                "state": p["state"],
                                "base_ref": p["base"]["ref"],
                                "head_ref": p["head"]["ref"],
                                "created_at": p["created_at"],
                                "changed_files_count": 0,
                                "additions": 0,
                                "deletions": 0,
                            })
                        return pr_list
            except Exception:
                pass

        return []

    async def get_pull_request_files(
        self, user_id: str, repo_full_name: str, pr_number: int
    ) -> Dict[str, Any]:
        """Fetch pull request metadata and files with base & head content."""
        if not db.check_repo_access(user_id, repo_full_name):
            if not any(r["full_name"] == repo_full_name for r in DEMO_REPOSITORIES):
                raise PermissionError(f"Access denied: You are not authorized to inspect '{repo_full_name}'.")

        # Check demo repo PRs
        if repo_full_name in DEMO_PULL_REQUESTS:
            prs = DEMO_PULL_REQUESTS[repo_full_name]
            for p in prs:
                if p["number"] == pr_number:
                    return p

        # Real GitHub API
        account = db.get_github_account(user_id)
        access_token = (account.get("access_token") if account else None) or settings.GITHUB_TOKEN
        if access_token:
            async with httpx.AsyncClient(timeout=15.0) as client:
                pr_res = await client.get(
                    f"https://api.github.com/repos/{repo_full_name}/pulls/{pr_number}",
                    headers={"Authorization": f"Bearer {access_token}", "Accept": "application/vnd.github.v3+json"},
                )
                if pr_res.status_code != 200:
                    raise FileNotFoundError(f"Pull request #{pr_number} not found on GitHub.")

                pr_data = pr_res.json()
                base_sha = pr_data.get("base", {}).get("sha", "")
                head_sha = pr_data.get("head", {}).get("sha", "")
                files_res = await client.get(
                    f"https://api.github.com/repos/{repo_full_name}/pulls/{pr_number}/files",
                    headers={"Authorization": f"Bearer {access_token}", "Accept": "application/vnd.github.v3+json"},
                )
                files_data = files_res.json() if files_res.status_code == 200 else []

                parsed_files = []
                for f in files_data:
                    head_content = ""
                    if head_sha and f.get("status") != "removed":
                        try:
                            head_res = await client.get(
                                f"https://api.github.com/repos/{repo_full_name}/contents/{f['filename']}?ref={head_sha}",
                                headers={
                                    "Authorization": f"Bearer {access_token}",
                                    "Accept": "application/vnd.github.v3.raw",
                                },
                            )
                            if head_res.status_code == 200:
                                head_content = head_res.text
                        except Exception:
                            pass

                    if not head_content and f.get("raw_url"):
                        try:
                            raw_res = await client.get(f["raw_url"])
                            if raw_res.status_code == 200:
                                head_content = raw_res.text
                        except Exception:
                            pass

                    base_content = ""
                    if base_sha and f.get("status") in ("modified", "removed"):
                        try:
                            base_res = await client.get(
                                f"https://api.github.com/repos/{repo_full_name}/contents/{f['filename']}?ref={base_sha}",
                                headers={
                                    "Authorization": f"Bearer {access_token}",
                                    "Accept": "application/vnd.github.v3.raw",
                                },
                            )
                            if base_res.status_code == 200:
                                base_content = base_res.text
                        except Exception:
                            pass

                    parsed_files.append({
                        "filename": f["filename"],
                        "status": f["status"],
                        "base_content": base_content,
                        "head_content": head_content,
                        "patch": f.get("patch", ""),
                    })

                return {
                    "number": pr_number,
                    "title": pr_data["title"],
                    "author": pr_data["user"]["login"],
                    "author_avatar": pr_data["user"]["avatar_url"],
                    "state": pr_data["state"],
                    "base_ref": pr_data["base"]["ref"],
                    "head_ref": pr_data["head"]["ref"],
                    "created_at": pr_data["created_at"],
                    "changed_files_count": len(parsed_files),
                    "additions": pr_data.get("additions", 0),
                    "deletions": pr_data.get("deletions", 0),
                    "files": parsed_files,
                }

        raise FileNotFoundError(f"PR #{pr_number} not found.")


github_service = GitHubService()
