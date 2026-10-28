"""
Authentication and Authorization Service for REGRAVA.
Supports Google OAuth/OIDC, GitHub App authorization, secure cookie-based session management,
and zero-credential demo exploration.
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
            # Return demo/mock instructions URL
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

    # --- GitHub App Installation & Connection Flow ---
    def get_github_auth_url(self) -> str:
        """
        URL for installing or authorizing the REGRAVA GitHub App.
        Requests minimum fine-grained read-only permissions on repositories.
        """
        state = self.generate_oauth_state("github")
        if settings.is_github_configured:
            params = {
                "client_id": settings.GITHUB_CLIENT_ID,
                "redirect_uri": settings.GITHUB_REDIRECT_URI,
                "scope": "read:user user:email",
                "state": state,
            }
            return f"https://github.com/login/oauth/authorize?{urllib.parse.urlencode(params)}"
        else:
            return f"/settings?action=github_setup&state={state}"

    async def handle_github_callback(self, user_id: str, code: str, state: str, installation_id: Optional[str] = None) -> Dict[str, Any]:
        if not self.verify_oauth_state(state, "github"):
            raise HTTPException(status_code=400, detail="Invalid OAuth state parameter.")

        if not settings.is_github_configured:
            # Demo/simulated connection
            demo_repos = ["demo-org/payment-service", "demo-org/user-service"]
            db.save_github_account(
                user_id=user_id,
                github_user_id="gh-demo-12345",
                github_username="demo-developer",
                installation_id=installation_id or "inst-demo-777",
                authorized_repos=demo_repos,
            )
            return {
                "github_username": "demo-developer",
                "authorized_repos": demo_repos,
                "is_live": False,
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
                raise HTTPException(status_code=400, detail=f"GitHub authorization error: {token_data.get('error_description')}")

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

            # Fetch repositories user has authorized for this installation or user repos
            repo_res = await client.get(
                "https://api.github.com/user/repos?per_page=100&type=owner",
                headers={
                    "Authorization": f"Bearer {access_token}",
                    "Accept": "application/vnd.github.v3+json",
                },
            )

            authorized_repos = []
            if repo_res.status_code == 200:
                authorized_repos = [r["full_name"] for r in repo_res.json() if "full_name" in r]

            db.save_github_account(
                user_id=user_id,
                github_user_id=gh_id,
                github_username=gh_username,
                installation_id=installation_id,
                authorized_repos=authorized_repos,
                access_token=access_token,
            )

            return {
                "github_username": gh_username,
                "authorized_repos": authorized_repos,
                "is_live": True,
            }

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

        # Pre-seed demo authorized repositories
        demo_repos = ["demo-org/payment-service", "demo-org/user-service"]
        db.save_github_account(
            user_id=user["id"],
            github_user_id="gh-demo-9999",
            github_username="alex-vance-dev",
            installation_id="inst-987654",
            authorized_repos=demo_repos,
        )

        session_token = self.generate_session_token()
        db.create_session(user["id"], session_token, duration_seconds=settings.SESSION_MAX_AGE_SECONDS)
        return {"user": user, "session_token": session_token}


auth_service = AuthService()


def get_current_user_optional(request: Request) -> Optional[Dict[str, Any]]:
    """Helper to inspect session cookie or Authorization header without raising 401."""
    # Check session cookie
    token = request.cookies.get(settings.SESSION_COOKIE_NAME)
    # Or check Authorization header (e.g. Bearer <token>)
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
