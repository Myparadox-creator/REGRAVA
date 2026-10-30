"""
Authentication and Authorization Service for REGRAVA.
Supports Google OAuth/OIDC, GitHub App & OAuth authorization, GitHub Personal Access Tokens,
secure cookie-based session management, and zero-credential demo exploration.
"""

import hashlib
import hmac
import secrets
import urllib.parse
from typing import Dict, List, Optional, Any
import httpx
from fastapi import Request, HTTPException, status
from app.config import settings
from app.db.session_db import db


class AuthService:
    def __init__(self):
        self.secret_key = settings.SECRET_KEY.encode("utf-8")

    # --- Session Token Creation & Verification ---
    def generate_session_token(self) -> str:
        return secrets.token_urlsafe(32)

    def generate_oauth_state(self, provider: str) -> str:
        """Create a tamper-evident state parameter to prevent CSRF in OAuth flows."""
        nonce = secrets.token_hex(16)
        sig = hmac.new(self.secret_key, f"{provider}:{nonce}".encode("utf-8"), hashlib.sha256).hexdigest()
        return f"{provider}:{nonce}:{sig[:16]}"

    def verify_oauth_state(self, state: str, expected_provider: str) -> bool:
        try:
            parts = state.split(":")
            if len(parts) != 3:
                return False
            provider, nonce, sig = parts
            if provider != expected_provider:
                return False
            expected_sig = hmac.new(self.secret_key, f"{provider}:{nonce}".encode("utf-8"), hashlib.sha256).hexdigest()
            return hmac.compare_digest(sig, expected_sig[:16])
        except Exception:
            return False

    # --- Google OAuth Flow ---
    def get_google_auth_url(self) -> str:
        if not settings.is_google_configured:
            return "/login?error=google_not_configured"

        state = self.generate_oauth_state("google")
        params = {
            "client_id": settings.GOOGLE_CLIENT_ID,
            "redirect_uri": settings.GOOGLE_REDIRECT_URI,
            "response_type": "code",
            "scope": "openid email profile",
            "state": state,
            "access_type": "offline",
            "prompt": "select_account",
        }
        return f"https://accounts.google.com/o/oauth2/v2/auth?{urllib.parse.urlencode(params)}"

    async def handle_google_callback(self, code: str, state: str) -> Dict[str, Any]:
        if not self.verify_oauth_state(state, "google"):
            raise HTTPException(status_code=400, detail="Invalid or expired OAuth state parameter (CSRF detected).")

        if not settings.is_google_configured:
            raise HTTPException(status_code=500, detail="Google OAuth credentials are not configured on this server.")

        token_url = "https://oauth2.googleapis.com/token"
        data = {
            "client_id": settings.GOOGLE_CLIENT_ID,
            "client_secret": settings.GOOGLE_CLIENT_SECRET,
            "code": code,
            "grant_type": "authorization_code",
            "redirect_uri": settings.GOOGLE_REDIRECT_URI,
        }

        async with httpx.AsyncClient(timeout=10.0) as client:
            token_res = await client.post(token_url, data=data)
            if token_res.status_code != 200:
                raise HTTPException(status_code=400, detail=f"Google token exchange failed: {token_res.text}")

            token_data = token_res.json()
            access_token = token_data.get("access_token")

            userinfo_res = await client.get(
                "https://openidconnect.googleapis.com/v1/userinfo",
                headers={"Authorization": f"Bearer {access_token}"},
            )
            if userinfo_res.status_code != 200:
                raise HTTPException(status_code=400, detail="Failed to fetch user profile from Google.")

            userinfo = userinfo_res.json()
            email = userinfo.get("email")
            name = userinfo.get("name") or email.split("@")[0]
            avatar = userinfo.get("picture")

            user = db.upsert_user(
                email=email,
                name=name,
                auth_provider="google",
                avatar_url=avatar,
                is_demo=False,
            )

            session_token = self.generate_session_token()
            db.create_session(user["id"], session_token, duration_seconds=settings.SESSION_MAX_AGE_SECONDS)
            return {"user": user, "session_token": session_token}

    # --- GitHub App & OAuth Connection Flow ---
    def get_github_auth_url(self) -> str:
        """
        Generate GitHub OAuth authorization URL with signed state.
        Requests permissions to inspect user identity and authorized repositories.
        """
        state = self.generate_oauth_state("github")
        if settings.GITHUB_CLIENT_ID and settings.GITHUB_CLIENT_SECRET:
            params = {
                "client_id": settings.GITHUB_CLIENT_ID,
                "redirect_uri": settings.GITHUB_REDIRECT_URI,
                "scope": "read:user user:email repo",
                "state": state,
            }
            return f"https://github.com/login/oauth/authorize?{urllib.parse.urlencode(params)}"
        else:
            return f"/settings?action=github_setup&state={state}"

    async def handle_github_callback(
        self, user_id: Optional[str], code: str, state: str, installation_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Exchange GitHub OAuth code for access token.
        Supports both logging in an unauthenticated user and linking GitHub to an existing account.
        """
        if not self.verify_oauth_state(state, "github"):
            raise HTTPException(status_code=400, detail="Invalid OAuth state parameter.")

        if not (settings.GITHUB_CLIENT_ID and settings.GITHUB_CLIENT_SECRET):
            # Demo/simulated connection fallback
            demo_repos = ["demo-org/payment-service", "demo-org/user-service"]
            target_user_id = user_id or "user-demo-01"
            db.save_github_account(
                user_id=target_user_id,
                github_user_id="gh-demo-12345",
                github_username="demo-developer",
                installation_id=installation_id or "inst-demo-777",
                authorized_repos=demo_repos,
            )
            return {
                "github_username": "demo-developer",
                "authorized_repos": demo_repos,
                "is_live": False,
                "session_token": None,
                "user": db.get_user_by_id(target_user_id),
            }

        async with httpx.AsyncClient(timeout=10.0) as client:
            token_res = await client.post(
                "https://github.com/login/oauth/access_token",
                data={
                    "client_id": settings.GITHUB_CLIENT_ID,
                    "client_secret": settings.GITHUB_CLIENT_SECRET,
                    "code": code,
                    "redirect_uri": settings.GITHUB_REDIRECT_URI,
                },
                headers={"Accept": "application/json"},
            )

            if token_res.status_code != 200:
                raise HTTPException(status_code=400, detail="Failed to exchange GitHub authorization code.")

            token_data = token_res.json()
            access_token = token_data.get("access_token")
            if not access_token:
                raise HTTPException(
                    status_code=400,
                    detail=f"GitHub authorization error: {token_data.get('error_description')}",
                )

            # Fetch user profile
            user_res = await client.get(
                "https://api.github.com/user",
                headers={
                    "Authorization": f"Bearer {access_token}",
                    "Accept": "application/vnd.github.v3+json",
                },
            )
            user_data = user_res.json() if user_res.status_code == 200 else {}
            gh_username = user_data.get("login", "unknown")
            gh_id = str(user_data.get("id", ""))
            gh_avatar = user_data.get("avatar_url")

            # Fetch user email if not public in profile
            email = user_data.get("email")
            if not email:
                try:
                    email_res = await client.get(
                        "https://api.github.com/user/emails",
                        headers={
                            "Authorization": f"Bearer {access_token}",
                            "Accept": "application/vnd.github.v3+json",
                        },
                    )
                    if email_res.status_code == 200:
                        emails = email_res.json()
                        primary = next((e["email"] for e in emails if e.get("primary")), None)
                        email = primary or (emails[0]["email"] if emails else None)
                except Exception:
                    pass
            if not email:
                email = f"{gh_username}@users.noreply.github.com"

            # Fetch real repositories accessible by this access token
            repo_res = await client.get(
                "https://api.github.com/user/repos?per_page=100&sort=updated&affiliation=owner,collaborator",
                headers={
                    "Authorization": f"Bearer {access_token}",
                    "Accept": "application/vnd.github.v3+json",
                },
            )

            authorized_repos = []
            if repo_res.status_code == 200:
                authorized_repos = [r["full_name"] for r in repo_res.json() if "full_name" in r]

            session_token = None
            if not user_id:
                # User signed in via GitHub directly from Auth screen
                user = db.upsert_user(
                    email=email,
                    name=user_data.get("name") or gh_username,
                    auth_provider="github",
                    avatar_url=gh_avatar,
                    is_demo=False,
                )
                user_id = user["id"]
                session_token = self.generate_session_token()
                db.create_session(user_id, session_token, duration_seconds=settings.SESSION_MAX_AGE_SECONDS)
            else:
                user = db.get_user_by_id(user_id)

            db.save_github_account(
                user_id=user_id,
                github_user_id=gh_id,
                github_username=gh_username,
                installation_id=installation_id or "oauth-app",
                authorized_repos=authorized_repos,
                access_token=access_token,
            )

            return {
                "github_username": gh_username,
                "authorized_repos": authorized_repos,
                "is_live": True,
                "user": user,
                "session_token": session_token,
            }

    # --- Direct GitHub Personal Access Token (PAT) Connection ---
    async def connect_github_token(self, user_id: Optional[str], token: str) -> Dict[str, Any]:
        """
        Connect or sign in directly using a GitHub Personal Access Token (PAT).
        Verifies token against GitHub API, fetches user profile & all repositories,
        and saves the GitHub account with full real-time access.
        """
        clean_token = token.strip()
        if not clean_token:
            raise HTTPException(status_code=400, detail="GitHub token cannot be empty.")

        async with httpx.AsyncClient(timeout=12.0) as client:
            user_res = await client.get(
                "https://api.github.com/user",
                headers={
                    "Authorization": f"Bearer {clean_token}",
                    "Accept": "application/vnd.github.v3+json",
                },
            )
            if user_res.status_code == 401:
                raise HTTPException(status_code=401, detail="Invalid GitHub token. Please verify token permissions.")
            if user_res.status_code != 200:
                raise HTTPException(status_code=user_res.status_code, detail="Failed to verify token with GitHub API.")

            user_data = user_res.json()
            gh_username = user_data.get("login", "unknown")
            gh_id = str(user_data.get("id", ""))
            gh_avatar = user_data.get("avatar_url")

            email = user_data.get("email")
            if not email:
                try:
                    email_res = await client.get(
                        "https://api.github.com/user/emails",
                        headers={"Authorization": f"Bearer {clean_token}", "Accept": "application/vnd.github.v3+json"},
                    )
                    if email_res.status_code == 200:
                        emails = email_res.json()
                        primary = next((e["email"] for e in emails if e.get("primary")), None)
                        email = primary or (emails[0]["email"] if emails else None)
                except Exception:
                    pass
            if not email:
                email = f"{gh_username}@users.noreply.github.com"

            # Fetch real repositories accessible by this token
            repo_res = await client.get(
                "https://api.github.com/user/repos?per_page=100&sort=updated&affiliation=owner,collaborator",
                headers={
                    "Authorization": f"Bearer {clean_token}",
                    "Accept": "application/vnd.github.v3+json",
                },
            )
            authorized_repos = []
            if repo_res.status_code == 200:
                authorized_repos = [r["full_name"] for r in repo_res.json() if "full_name" in r]

            session_token = None
            if not user_id:
                user = db.upsert_user(
                    email=email,
                    name=user_data.get("name") or gh_username,
                    auth_provider="github",
                    avatar_url=gh_avatar,
                    is_demo=False,
                )
                user_id = user["id"]
                session_token = self.generate_session_token()
                db.create_session(user_id, session_token, duration_seconds=settings.SESSION_MAX_AGE_SECONDS)
            else:
                user = db.get_user_by_id(user_id)

            db.save_github_account(
                user_id=user_id,
                github_user_id=gh_id,
                github_username=gh_username,
                installation_id="pat-token",
                authorized_repos=authorized_repos,
                access_token=clean_token,
            )

            return {
                "github_username": gh_username,
                "authorized_repos": authorized_repos,
                "user": user,
                "session_token": session_token,
                "is_live": True,
            }

    def revoke_github_connection(self, user_id: str) -> None:
        """Revoke linked GitHub account credentials and repository access."""
        db.revoke_github_account(user_id)

    # --- Demo Login (Zero Credentials Required) ---
    def create_demo_user_session(self) -> Dict[str, Any]:
        """Creates or retrieves a verified demo user with pre-seeded sample repositories and PRs."""
        demo_email = "alex.vance@regrava.local"
        user = db.upsert_user(
            email=demo_email,
            name="Alex Vance (Demo Developer)",
            auth_provider="demo",
            avatar_url="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80",
            is_demo=True,
        )

        # Pre-seed demo authorized repositories (if live GITHUB_TOKEN not configured)
        access_token = settings.GITHUB_TOKEN or None
        demo_repos = ["demo-org/payment-service", "demo-org/user-service"]
        db.save_github_account(
            user_id=user["id"],
            github_user_id="gh-demo-9999",
            github_username="alex-vance-dev",
            installation_id="inst-987654",
            authorized_repos=demo_repos,
            access_token=access_token,
        )

        session_token = self.generate_session_token()
        db.create_session(user["id"], session_token, duration_seconds=settings.SESSION_MAX_AGE_SECONDS)
        return {"user": user, "session_token": session_token}


auth_service = AuthService()


def get_current_user_optional(request: Request) -> Optional[Dict[str, Any]]:
    """Helper to inspect session cookie or Authorization header without raising 401."""
    token = request.cookies.get(settings.SESSION_COOKIE_NAME)
    if not token and "Authorization" in request.headers:
        auth_header = request.headers["Authorization"]
        if auth_header.startswith("Bearer "):
            token = auth_header[7:].strip()

    if not token:
        return None

    session = db.get_session(token)
    if not session:
        return None

    user = db.get_user_by_id(session["user_id"])
    if not user:
        return None

    user["session_token"] = token
    return user


def get_current_user(request: Request) -> Dict[str, Any]:
    """Dependency that requires an authenticated session."""
    user = get_current_user_optional(request)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required. Please sign in with Google, GitHub, or use Demo Mode.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user
