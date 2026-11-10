"""
Authentication API routes for REGRAVA.
Supports Google OAuth/OIDC, GitHub App authorization, GitHub Personal Access Tokens,
session validation, and demo user exploration.
"""

from typing import Dict, Any, Optional
import logging
from urllib.parse import quote_plus
from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from fastapi.responses import RedirectResponse
from pydantic import BaseModel
from app.config import settings
from app.db.session_db import db
from app.services.auth_service import auth_service, get_current_user, get_current_user_optional

router = APIRouter(prefix="/auth", tags=["Authentication"])


class GoogleCallbackRequest(BaseModel):
    code: str
    state: str


class GoogleConfigureRequest(BaseModel):
    client_id: str
    client_secret: str


class GitHubCallbackRequest(BaseModel):
    code: str
    state: str
    installation_id: Optional[str] = None


class GitHubTokenRequest(BaseModel):
    token: str


class GitHubConfigureRequest(BaseModel):
    client_id: str
    client_secret: str


def _get_base_and_callback(request: Request, default_callback: str, default_frontend: str, callback_path: str):
    host = request.headers.get("host", "")
    proto = request.headers.get(
        "x-forwarded-proto",
        "http" if "127.0.0.1" in host or "localhost" in host else "https",
    )
    if host and "127.0.0.1" not in host and "localhost" not in host:
        frontend_base = f"{proto}://{host}"
        callback_url = f"{proto}://{host}{callback_path}"
    else:
        frontend_base = default_frontend.rstrip("/")
        if "127.0.0.1" in host and "localhost" in frontend_base:
            frontend_base = frontend_base.replace("localhost", "127.0.0.1")
        elif "localhost" in host and "127.0.0.1" in frontend_base:
            frontend_base = frontend_base.replace("127.0.0.1", "localhost")
        callback_url = default_callback
        if "127.0.0.1" in host and "localhost" in callback_url:
            callback_url = callback_url.replace("localhost", "127.0.0.1")
        elif "localhost" in host and "127.0.0.1" in callback_url:
            callback_url = callback_url.replace("127.0.0.1", "localhost")
    return frontend_base, callback_url


@router.get("/google/url")
def get_google_auth_url(request: Request):
    """Return the Google OAuth authorization URL."""
    _, callback_url = _get_base_and_callback(
        request, settings.GOOGLE_REDIRECT_URI, settings.GITHUB_FRONTEND_URL, "/api/auth/google/callback"
    )
    return {
        "url": auth_service.get_google_auth_url(redirect_uri=callback_url),
        "is_configured": settings.is_google_configured,
        "callback_url": callback_url,
    }


@router.get("/google/config-info")
def get_google_config_info(request: Request):
    """Return public metadata needed to configure Google OAuth credentials."""
    client_id = settings.get_google_client_id()
    masked_client_id = (
        f"{client_id[:8]}...{client_id[-8:]}" if client_id and len(client_id) > 16 else client_id
    )
    frontend_base, callback_url = _get_base_and_callback(
        request, settings.GOOGLE_REDIRECT_URI, settings.GITHUB_FRONTEND_URL, "/api/auth/google/callback"
    )
    origin_urls = (
        [frontend_base]
        if "127.0.0.1" not in frontend_base and "localhost" not in frontend_base
        else ["http://localhost:5173", "http://127.0.0.1:5173"]
    )
    return {
        "is_configured": settings.is_google_configured,
        "client_id": masked_client_id,
        "callback_url": callback_url,
        "origin_urls": origin_urls,
        "setup_url": "https://console.cloud.google.com/apis/credentials/oauthclient",
    }


@router.post("/google/configure")
def configure_google_oauth(request: GoogleConfigureRequest):
    """Configure or update Google OAuth credentials in-memory and in SQLite/env."""
    cid = request.client_id.strip()
    csec = request.client_secret.strip()
    if not cid or not csec:
        raise HTTPException(status_code=400, detail="Client ID and Client Secret are required.")

    db.set_config("GOOGLE_CLIENT_ID", cid)
    db.set_config("GOOGLE_CLIENT_SECRET", csec)
    settings.GOOGLE_CLIENT_ID = cid
    settings.GOOGLE_CLIENT_SECRET = csec

    # Persist to .env if writable and not test fixture
    if not cid.startswith("test_"):
        try:
            env_path = settings.PROJECT_ROOT / ".env"
            lines = []
            if env_path.exists():
                lines = env_path.read_text(encoding="utf-8").splitlines()

            cid_found = False
            csec_found = False
            new_lines = []
            for line in lines:
                if line.startswith("GOOGLE_CLIENT_ID="):
                    new_lines.append(f"GOOGLE_CLIENT_ID={cid}")
                    cid_found = True
                elif line.startswith("GOOGLE_CLIENT_SECRET="):
                    new_lines.append(f"GOOGLE_CLIENT_SECRET={csec}")
                    csec_found = True
                else:
                    new_lines.append(line)
            if not cid_found:
                new_lines.append(f"GOOGLE_CLIENT_ID={cid}")
            if not csec_found:
                new_lines.append(f"GOOGLE_CLIENT_SECRET={csec}")

            env_path.write_text("\n".join(new_lines) + "\n", encoding="utf-8")
        except Exception:
            pass

    return {
        "status": "configured",
        "is_configured": True,
        "auth_url": auth_service.get_google_auth_url(),
    }


@router.get("/google/callback")
async def google_browser_callback(
    request: Request,
    code: Optional[str] = None,
    state: Optional[str] = None,
    error: Optional[str] = None,
    error_description: Optional[str] = None,
):
    """
    Handle browser redirect from Google OAuth authorization.
    Exchanges authorization code, sets session cookie and token, and redirects user to frontend dashboard.
    """
    frontend_base, callback_url = _get_base_and_callback(
        request, settings.GOOGLE_REDIRECT_URI, settings.GITHUB_FRONTEND_URL, "/api/auth/google/callback"
    )

    if error or not code:
        err_msg = error_description or error or "Google authorization was canceled or failed."
        return RedirectResponse(
            url=f"{frontend_base}/?google_auth=error&msg={quote_plus(err_msg)}",
            status_code=302,
        )

    try:
        current_user = get_current_user_optional(request)
        user_id = current_user["id"] if current_user else None

        result = await auth_service.handle_google_callback(
            code=code,
            state=state or "",
            user_id=user_id,
            redirect_uri=callback_url,
        )

        session_token = result.get("session_token")
        target_url = f"{frontend_base}/?google_auth=success"
        if session_token:
            target_url += f"&token={session_token}"

        redirect_res = RedirectResponse(url=target_url, status_code=302)

        if session_token:
            redirect_res.set_cookie(
                key=settings.SESSION_COOKIE_NAME,
                value=session_token,
                max_age=settings.SESSION_MAX_AGE_SECONDS,
                httponly=True,
                secure=settings.COOKIE_SECURE,
                samesite="lax",
                path="/",
            )

        return redirect_res
    except Exception as exc:
        logger.exception("Google OAuth callback failed")
        detail = getattr(exc, "detail", str(exc))
        return RedirectResponse(
            url=f"{frontend_base}/?google_auth=error&msg={quote_plus(str(detail))}",
            status_code=302,
        )


@router.post("/google/callback")
async def google_callback(
    request: GoogleCallbackRequest,
    req: Request,
    response: Response,
):
    """Exchange Google OAuth authorization code for session."""
    current_user = get_current_user_optional(req)
    user_id = current_user["id"] if current_user else None

    result = await auth_service.handle_google_callback(
        code=request.code,
        state=request.state,
        user_id=user_id,
    )
    session_token = result["session_token"]

    response.set_cookie(
        key=settings.SESSION_COOKIE_NAME,
        value=session_token,
        max_age=settings.SESSION_MAX_AGE_SECONDS,
        httponly=True,
        secure=settings.COOKIE_SECURE,
        samesite=settings.COOKIE_SAMESITE,
        path="/",
    )
    return {
        "status": "authenticated",
        "user": result["user"],
        "token": session_token,
    }


@router.get("/github/url")
def get_github_auth_url(request: Request):
    """Return the GitHub App/OAuth authorization URL."""
    _, callback_url = _get_base_and_callback(
        request, settings.GITHUB_REDIRECT_URI, settings.GITHUB_FRONTEND_URL, "/api/auth/github/callback"
    )
    return {
        "url": auth_service.get_github_auth_url(redirect_uri=callback_url),
        "is_configured": settings.is_github_oauth_configured,
        "app_name": settings.GITHUB_APP_NAME,
        "callback_url": callback_url,
    }


@router.get("/github/config-info")
def get_github_config_info(request: Request):
    """Return public metadata needed to configure GitHub OAuth App."""
    client_id = settings.get_github_client_id()
    masked_client_id = (
        f"{client_id[:6]}...{client_id[-4:]}" if client_id and len(client_id) > 10 else client_id
    )
    frontend_base, callback_url = _get_base_and_callback(
        request, settings.GITHUB_REDIRECT_URI, settings.GITHUB_FRONTEND_URL, "/api/auth/github/callback"
    )
    return {
        "is_configured": settings.is_github_oauth_configured,
        "client_id": masked_client_id,
        "callback_url": callback_url,
        "homepage_url": frontend_base,
        "setup_url": "https://github.com/settings/applications/new",
    }


@router.post("/github/configure")
def configure_github_oauth(request: GitHubConfigureRequest):
    """Configure or update GitHub OAuth App credentials in-memory and in SQLite/env."""
    cid = request.client_id.strip()
    csec = request.client_secret.strip()
    if not cid or not csec:
        raise HTTPException(status_code=400, detail="Client ID and Client Secret are required.")

    db.set_config("GITHUB_CLIENT_ID", cid)
    db.set_config("GITHUB_CLIENT_SECRET", csec)
    settings.GITHUB_CLIENT_ID = cid
    settings.GITHUB_CLIENT_SECRET = csec

    # Persist to .env if writable and not test fixture
    if not cid.startswith("test_"):
        try:
            env_path = settings.PROJECT_ROOT / ".env"
            lines = []
            if env_path.exists():
                lines = env_path.read_text(encoding="utf-8").splitlines()

            cid_found = False
            csec_found = False
            new_lines = []
            for line in lines:
                if line.startswith("GITHUB_CLIENT_ID="):
                    new_lines.append(f"GITHUB_CLIENT_ID={cid}")
                    cid_found = True
                elif line.startswith("GITHUB_CLIENT_SECRET="):
                    new_lines.append(f"GITHUB_CLIENT_SECRET={csec}")
                    csec_found = True
                else:
                    new_lines.append(line)
            if not cid_found:
                new_lines.append(f"GITHUB_CLIENT_ID={cid}")
            if not csec_found:
                new_lines.append(f"GITHUB_CLIENT_SECRET={csec}")

            env_path.write_text("\n".join(new_lines) + "\n", encoding="utf-8")
        except Exception:
            pass

    return {
        "status": "configured",
        "is_configured": True,
        "auth_url": auth_service.get_github_auth_url(),
    }


logger = logging.getLogger("regrava.auth")


@router.get("/github/callback")
async def github_browser_callback(
    request: Request,
    code: Optional[str] = None,
    state: Optional[str] = None,
    error: Optional[str] = None,
    error_description: Optional[str] = None,
    installation_id: Optional[str] = None,
):
    """
    Handle browser redirect from GitHub OAuth authorization.
    Exchanges authorization code, sets session cookie and token, and redirects user to frontend dashboard.
    """
    frontend_base, callback_url = _get_base_and_callback(
        request, settings.GITHUB_REDIRECT_URI, settings.GITHUB_FRONTEND_URL, "/api/auth/github/callback"
    )

    if error or not code:
        err_msg = error_description or error or "GitHub authorization was canceled or failed."
        return RedirectResponse(
            url=f"{frontend_base}/?github_auth=error&msg={quote_plus(err_msg)}",
            status_code=302,
        )

    try:
        current_user = get_current_user_optional(request)
        user_id = current_user["id"] if current_user else None

        result = await auth_service.handle_github_callback(
            user_id=user_id,
            code=code,
            state=state or "",
            installation_id=installation_id,
            redirect_uri=callback_url,
        )

        session_token = result.get("session_token")
        target_url = f"{frontend_base}/?github_auth=success"
        if session_token:
            target_url += f"&token={session_token}"

        redirect_res = RedirectResponse(url=target_url, status_code=302)

        if session_token:
            redirect_res.set_cookie(
                key=settings.SESSION_COOKIE_NAME,
                value=session_token,
                max_age=settings.SESSION_MAX_AGE_SECONDS,
                httponly=True,
                secure=settings.COOKIE_SECURE,
                samesite="lax",
                path="/",
            )

        return redirect_res
    except Exception as exc:
        logger.exception("GitHub OAuth callback failed")
        detail = getattr(exc, "detail", str(exc))
        return RedirectResponse(
            url=f"{frontend_base}/?github_auth=error&msg={quote_plus(str(detail))}",
            status_code=302,
        )


@router.post("/github/callback")
async def github_callback(
    request: GitHubCallbackRequest,
    req: Request,
    response: Response,
):
    """Process GitHub OAuth code via JSON POST request."""
    current_user = get_current_user_optional(req)
    user_id = current_user["id"] if current_user else None

    result = await auth_service.handle_github_callback(
        user_id=user_id,
        code=request.code,
        state=request.state,
        installation_id=request.installation_id,
    )

    session_token = result.get("session_token")
    if session_token:
        response.set_cookie(
            key=settings.SESSION_COOKIE_NAME,
            value=session_token,
            max_age=settings.SESSION_MAX_AGE_SECONDS,
            httponly=True,
            secure=settings.COOKIE_SECURE,
            samesite=settings.COOKIE_SAMESITE,
            path="/",
        )

    return {
        "status": "connected",
        "token": session_token,
        "github_username": result.get("github_username"),
        "authorized_repos": result.get("authorized_repos", []),
        "is_live": result.get("is_live", False),
        "user": result.get("user"),
    }


@router.post("/github/token")
async def connect_github_token(
    request: GitHubTokenRequest,
    req: Request,
    response: Response,
):
    """
    Connect to GitHub using a Personal Access Token (classic or fine-grained with repo scope).
    Validates token, loads real repositories, and associates with the user account.
    """
    current_user = get_current_user_optional(req)
    user_id = current_user["id"] if current_user else None

    result = await auth_service.connect_github_token(user_id=user_id, token=request.token)

    session_token = result.get("session_token")
    if session_token:
        response.set_cookie(
            key=settings.SESSION_COOKIE_NAME,
            value=session_token,
            max_age=settings.SESSION_MAX_AGE_SECONDS,
            httponly=True,
            secure=settings.COOKIE_SECURE,
            samesite=settings.COOKIE_SAMESITE,
            path="/",
        )

    return {
        "status": "connected",
        "token": session_token,
        "github_username": result.get("github_username"),
        "authorized_repos": result.get("authorized_repos", []),
        "is_live": True,
        "user": result.get("user"),
    }


@router.post("/github/disconnect")
def disconnect_github(current_user: Dict[str, Any] = Depends(get_current_user)):
    """Disconnect GitHub account and revoke access tokens from local session."""
    auth_service.revoke_github_connection(current_user["id"])
    return {"status": "disconnected"}


@router.post("/demo-login")
def demo_login(response: Response):
    """
    Zero-configuration demonstration login.
    Creates an isolated demo session with pre-authorized sample repositories and findings.
    """
    result = auth_service.create_demo_user_session()
    session_token = result["session_token"]

    response.set_cookie(
        key=settings.SESSION_COOKIE_NAME,
        value=session_token,
        max_age=settings.SESSION_MAX_AGE_SECONDS,
        httponly=True,
        secure=settings.COOKIE_SECURE,
        samesite=settings.COOKIE_SAMESITE,
        path="/",
    )
    return {
        "status": "authenticated",
        "user": result["user"],
        "token": session_token,
        "mode": "demo",
    }


@router.get("/me")
def get_me(current_user: Optional[Dict[str, Any]] = Depends(get_current_user_optional)):
    """Return current authenticated user profile, GitHub connection status, and authorized repositories."""
    if not current_user:
        return {
            "authenticated": False,
            "user": None,
            "github_account": None,
            "config_status": {
                "google_configured": settings.is_google_configured,
                "github_configured": settings.is_github_configured,
            },
        }

    gh_account = db.get_github_account(current_user["id"])
    return {
        "authenticated": True,
        "user": {
            "id": current_user["id"],
            "email": current_user["email"],
            "name": current_user["name"],
            "avatar_url": current_user.get("avatar_url"),
            "auth_provider": current_user.get("auth_provider"),
            "is_demo": bool(current_user.get("is_demo")),
        },
        "github_account": gh_account,
        "config_status": {
            "google_configured": settings.is_google_configured,
            "github_configured": settings.is_github_configured,
        },
    }


@router.post("/logout")
def logout(response: Response, current_user: Optional[Dict[str, Any]] = Depends(get_current_user_optional)):
    """Invalidate session and clear cookie."""
    if current_user and "session_token" in current_user:
        db.delete_session(current_user["session_token"])

    response.delete_cookie(key=settings.SESSION_COOKIE_NAME, path="/")
    return {"status": "logged_out"}
