"""
GitHub App Authentication & Installation Token Service for REGRAVA.
Generates short-lived RS256 App JWTs, exchanges them for repository installation
access tokens, verifies installation repository permissions, and handles HTTP rate-limits/retries.
"""

from __future__ import annotations

import asyncio
import logging
import time
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple
import httpx
import jwt
from app.config import settings
from app.db.session_db import db

logger = logging.getLogger(__name__)


class GitHubAppError(Exception):
    """Base error for GitHub App API operations."""

    def __init__(self, message: str, status_code: int = 500, recoverable: bool = False):
        super().__init__(message)
        self.message = message
        self.status_code = status_code
        self.recoverable = recoverable


class GitHubAppAuthService:
    """Manages GitHub App RS256 JWTs and short-lived installation access tokens."""

    GITHUB_API_BASE = "https://api.github.com"

    def __init__(self) -> None:
        # In-memory cache: installation_id -> {"token": str, "expires_at_ts": float}
        self._token_cache: Dict[str, Dict[str, Any]] = {}

    def is_configured(self) -> bool:
        return settings.is_github_app_configured

    def create_app_jwt(self) -> str:
        """
        Generate a short-lived RS256 JWT signed with the GitHub App private key.
        Valid for 9 minutes (GitHub maximum is 10 minutes).
        """
        app_id = settings.get_github_app_id()
        private_key = settings.get_github_app_private_key()
        if not app_id or not private_key:
            raise GitHubAppError(
                "GitHub App credentials (GITHUB_APP_ID and private key) are not configured.",
                status_code=503,
                recoverable=False,
            )

        now = int(time.time())
        payload = {
            "iat": now - 60,  # Clock skew tolerance
            "exp": now + 540,  # 9 minutes
            "iss": str(app_id),
        }
        try:
            encoded = jwt.encode(payload, private_key, algorithm="RS256")
            if isinstance(encoded, bytes):
                encoded = encoded.decode("utf-8")
            return encoded
        except Exception as exc:
            raise GitHubAppError(
                f"Failed to sign GitHub App JWT. Verify private key PEM format: {type(exc).__name__}",
                status_code=500,
                recoverable=False,
            ) from exc

    def invalidate_installation_token(self, installation_id: str) -> None:
        self._token_cache.pop(str(installation_id), None)

    async def get_installation_for_repo(
        self, owner: str, repo: str, client: Optional[httpx.AsyncClient] = None
    ) -> Dict[str, Any]:
        """
        Resolve the GitHub App installation record for `{owner}/{repo}`.
        Uses cached DB installation first if available, and validates via GitHub API when App is configured.
        """
        full_name = f"{owner}/{repo}"
        if not self.is_configured():
            cached = db.find_installation_for_repo(full_name)
            if cached:
                return cached
            raise GitHubAppError(
                f"GitHub App is not installed or configured for '{full_name}'.",
                status_code=404,
                recoverable=False,
            )

        app_jwt = self.create_app_jwt()
        headers = {
            "Authorization": f"Bearer {app_jwt}",
            "Accept": "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
        }
        url = f"{self.GITHUB_API_BASE}/repos/{owner}/{repo}/installation"

        own_client = client is None
        http_client = client or httpx.AsyncClient(timeout=12.0)
        try:
            res = await http_client.get(url, headers=headers)
            if res.status_code == 200:
                data = res.json()
                inst_id = str(data["id"])
                account = data.get("account") or {}
                existing = db.get_installation(inst_id)
                existing_repos = set(existing.get("repositories", [])) if existing else set()
                existing_repos.add(full_name)
                db.upsert_installation(
                    installation_id=inst_id,
                    account_login=account.get("login"),
                    account_type=account.get("type"),
                    repositories=sorted(existing_repos),
                    repository_selection=data.get("repository_selection", "selected"),
                    suspended=bool(data.get("suspended_at")),
                )
                return {
                    "installation_id": inst_id,
                    "account_login": account.get("login"),
                    "suspended": bool(data.get("suspended_at")),
                }
            if res.status_code == 404:
                raise GitHubAppError(
                    f"REGRAVA GitHub App is not installed on repository '{full_name}', or lacks access.",
                    status_code=404,
                    recoverable=False,
                )
            if res.status_code == 401:
                raise GitHubAppError(
                    "GitHub App JWT authentication failed. Verify GITHUB_APP_ID and private key.",
                    status_code=401,
                    recoverable=False,
                )
            if res.status_code == 403:
                raise GitHubAppError(
                    f"REGRAVA GitHub App lacks permission to inspect '{full_name}'.",
                    status_code=403,
                    recoverable=False,
                )
            raise GitHubAppError(
                f"GitHub App installation lookup returned HTTP {res.status_code}.",
                status_code=res.status_code,
                recoverable=res.status_code >= 500,
            )
        finally:
            if own_client:
                await http_client.aclose()

    async def get_installation_token(
        self, installation_id: str, force_refresh: bool = False, client: Optional[httpx.AsyncClient] = None
    ) -> str:
        """
        Obtain a short-lived installation access token for repository API operations.
        Never caches past expiry and never exposes the token outside backend memory.
        """
        inst_key = str(installation_id)
        if not force_refresh and inst_key in self._token_cache:
            cached = self._token_cache[inst_key]
            if cached.get("expires_at_ts", 0) - 60 > time.time():
                return cached["token"]

        app_jwt = self.create_app_jwt()
        headers = {
            "Authorization": f"Bearer {app_jwt}",
            "Accept": "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
        }
        url = f"{self.GITHUB_API_BASE}/app/installations/{inst_key}/access_tokens"

        own_client = client is None
        http_client = client or httpx.AsyncClient(timeout=12.0)
        try:
            res = await http_client.post(url, headers=headers)
            if res.status_code in (200, 201):
                data = res.json()
                token = data.get("token")
                if not token:
                    raise GitHubAppError("GitHub did not return an installation token.", status_code=502)
                exp_str = data.get("expires_at")
                exp_ts = time.time() + 3300  # 55m default fallback
                if exp_str:
                    try:
                        dt = datetime.fromisoformat(exp_str.replace("Z", "+00:00"))
                        exp_ts = dt.timestamp()
                    except Exception:
                        pass
                self._token_cache[inst_key] = {"token": token, "expires_at_ts": exp_ts}
                return token
            if res.status_code == 401:
                raise GitHubAppError(
                    "GitHub App credentials rejected when requesting installation token.",
                    status_code=401,
                )
            if res.status_code == 403:
                raise GitHubAppError(
                    "GitHub App installation is suspended or lacks required permissions.",
                    status_code=403,
                )
            if res.status_code == 404:
                raise GitHubAppError(
                    f"GitHub App installation '{inst_key}' not found.",
                    status_code=404,
                )
            raise GitHubAppError(
                f"Failed to obtain installation access token (HTTP {res.status_code}).",
                status_code=res.status_code,
                recoverable=res.status_code >= 500,
            )
        finally:
            if own_client:
                await http_client.aclose()

    async def verify_repo_accessible_to_installation(
        self, installation_id: str, repo_full_name: str, client: Optional[httpx.AsyncClient] = None
    ) -> bool:
        """Confirm that a repository is genuinely accessible through this installation."""
        inst = db.get_installation(installation_id)
        if inst and inst.get("suspended"):
            return False
        if inst and inst.get("repository_selection") == "all":
            return True
        if inst and any(r.lower() == repo_full_name.lower() for r in inst.get("repositories", [])):
            return True

        if not self.is_configured():
            return False

        # Query GitHub API /installation/repositories to double check
        try:
            res = await self.request_with_installation(
                installation_id,
                "GET",
                f"{self.GITHUB_API_BASE}/installation/repositories?per_page=100",
                client=client,
            )
            if res.status_code == 200:
                repos = [r.get("full_name", "") for r in res.json().get("repositories", []) if r.get("full_name")]
                db.upsert_installation(
                    installation_id=installation_id,
                    account_login=inst.get("account_login") if inst else None,
                    repositories=repos,
                    repository_selection=inst.get("repository_selection", "selected") if inst else "selected",
                )
                return any(r.lower() == repo_full_name.lower() for r in repos)
        except Exception as exc:
            logger.warning("Installation repo verification failed for %s: %s", repo_full_name, type(exc).__name__)
        return False

    async def request_with_installation(
        self,
        installation_id: str,
        method: str,
        url: str,
        json_body: Optional[Dict[str, Any]] = None,
        extra_headers: Optional[Dict[str, str]] = None,
        max_retries: int = 2,
        client: Optional[httpx.AsyncClient] = None,
    ) -> httpx.Response:
        """
        Execute an authenticated GitHub API call as the GitHub App installation.
        Handles 401 token refresh, 429/secondary rate-limit backoff, and transient 5xx retries.
        """
        own_client = client is None
        http_client = client or httpx.AsyncClient(timeout=15.0)
        force_refresh = False

        try:
            for attempt in range(max_retries + 1):
                token = await self.get_installation_token(
                    installation_id, force_refresh=force_refresh, client=http_client
                )
                force_refresh = False

                headers = {
                    "Authorization": f"Bearer {token}",
                    "Accept": "application/vnd.github+json",
                    "X-GitHub-Api-Version": "2022-11-28",
                }
                if extra_headers:
                    headers.update(extra_headers)

                res = await http_client.request(method, url, headers=headers, json=json_body)

                # 401 -> invalidate cached installation token and retry once
                if res.status_code == 401 and attempt < max_retries:
                    self.invalidate_installation_token(installation_id)
                    force_refresh = True
                    continue

                # 429 or secondary rate limit (403 with retry-after or rate limit wording)
                is_rate_limit = res.status_code == 429 or (
                    res.status_code == 403
                    and ("rate limit" in res.text.lower() or "retry-after" in {k.lower() for k in res.headers.keys()})
                )
                if is_rate_limit and attempt < max_retries:
                    retry_after = res.headers.get("Retry-After") or res.headers.get("retry-after")
                    wait_sec = min(float(retry_after), 5.0) if retry_after and str(retry_after).isdigit() else (1.0 * (attempt + 1))
                    await asyncio.sleep(wait_sec)
                    continue

                # Transient 5xx from GitHub
                if res.status_code >= 500 and attempt < max_retries:
                    await asyncio.sleep(0.5 * (attempt + 1))
                    continue

                return res

            return res  # type: ignore[possibly-undefined]
        finally:
            if own_client:
                await http_client.aclose()


github_app_auth = GitHubAppAuthService()
