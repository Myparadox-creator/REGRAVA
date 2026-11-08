"""
Unit and integration tests for REGRAVA authentication, session handling,
and Google/GitHub OAuth state verification.
"""

from fastapi.testclient import TestClient
from app.main import app
from app.config import settings
from app.services.auth_service import auth_service
from app.db.session_db import db

client = TestClient(app)


def test_oauth_state_generation_and_validation():
    state = auth_service.generate_oauth_state("google")
    assert auth_service.verify_oauth_state(state, "google") is True
    assert auth_service.verify_oauth_state(state, "github") is False

    # Tampered state
    tampered = state + "bad"
    assert auth_service.verify_oauth_state(tampered, "google") is False


def test_auth_me_unauthenticated():
    res = client.get("/api/auth/me")
    assert res.status_code == 200
    data = res.json()
    assert data["authenticated"] is False
    assert data["user"] is None


def test_demo_login_and_session_cookie():
    # 1. Login with Demo endpoint
    login_res = client.post("/api/auth/demo-login")
    assert login_res.status_code == 200
    login_data = login_res.json()
    assert login_data["status"] == "authenticated"
    assert login_data["mode"] == "demo"
    assert "token" in login_data

    # Verify session cookie was set
    assert "regrava_session" in login_res.cookies
    session_token = login_res.cookies["regrava_session"]

    # 2. Check /api/auth/me with session
    me_res = client.get("/api/auth/me", cookies={"regrava_session": session_token})
    assert me_res.status_code == 200
    me_data = me_res.json()
    assert me_data["authenticated"] is True
    assert me_data["user"]["is_demo"] is True
    assert "alex" in me_data["user"]["email"].lower()
    assert me_data["github_account"] is not None
    assert len(me_data["github_account"]["authorized_repos"]) >= 2

    # 3. Logout
    logout_res = client.post("/api/auth/logout", cookies={"regrava_session": session_token})
    assert logout_res.status_code == 200

    # 4. Confirm session was invalidated
    me_after = client.get("/api/auth/me", cookies={"regrava_session": session_token})
    assert me_after.status_code == 200
    assert me_after.json()["authenticated"] is False


def test_protected_route_requires_auth():
    unauth_client = TestClient(app)
    res = unauth_client.get("/api/repos")
    assert res.status_code == 401
    assert "Authentication required" in res.json()["detail"]



def test_github_config_and_oauth_flow():
    orig_cid = settings.GITHUB_CLIENT_ID
    orig_csec = settings.GITHUB_CLIENT_SECRET
    try:
        # 1. Fetch initial config info
        info_res = client.get("/api/auth/github/config-info")
        assert info_res.status_code == 200
        info_data = info_res.json()
        assert "callback_url" in info_data
        assert "homepage_url" in info_data

        # 2. Configure GitHub credentials
        conf_res = client.post(
            "/api/auth/github/configure",
            json={"client_id": "test_gh_client_id_12345", "client_secret": "test_gh_secret_67890"},
        )
        assert conf_res.status_code == 200
        conf_data = conf_res.json()
        assert conf_data["status"] == "configured"
        assert conf_data["is_configured"] is True

        # 3. Verify OAuth URL now points to GitHub authorize with client_id
        url_res = client.get("/api/auth/github/url")
        assert url_res.status_code == 200
        url_data = url_res.json()
        assert url_data["is_configured"] is False  # test_ prefix is correctly treated as non-live test fixture
        assert "github.com/login/oauth/authorize" in url_data["url"]
        assert "client_id=test_gh_client_id_12345" in url_data["url"]
        assert "scope=read%3Auser+user%3Aemail+repo" in url_data["url"]
    finally:
        # 4. Teardown: Clean up test keys from db and restore original settings
        with db._get_connection() as conn:
            conn.execute("DELETE FROM app_config WHERE key LIKE 'GITHUB_%'")
            conn.commit()
        settings.GITHUB_CLIENT_ID = orig_cid
        settings.GITHUB_CLIENT_SECRET = orig_csec


def test_google_config_and_oauth_flow():
    orig_cid = settings.GOOGLE_CLIENT_ID
    orig_csec = settings.GOOGLE_CLIENT_SECRET
    try:
        info_res = client.get("/api/auth/google/config-info")
        assert info_res.status_code == 200
        info_data = info_res.json()
        assert "callback_url" in info_data
        assert "setup_url" in info_data
        assert "origin_urls" in info_data

        conf_res = client.post(
            "/api/auth/google/configure",
            json={"client_id": "test_google_client_id_12345.apps.googleusercontent.com", "client_secret": "test_google_secret_67890"},
        )
        assert conf_res.status_code == 200
        conf_data = conf_res.json()
        assert conf_data["status"] == "configured"
        assert conf_data["is_configured"] is True

        url_res = client.get("/api/auth/google/url")
        assert url_res.status_code == 200
        url_data = url_res.json()
        assert url_data["is_configured"] is False
        assert "accounts.google.com/o/oauth2/v2/auth" in url_data["url"]
        assert "client_id=test_google_client_id_12345.apps.googleusercontent.com" in url_data["url"]
        assert "scope=openid+email+profile" in url_data["url"]
    finally:
        with db._get_connection() as conn:
            conn.execute("DELETE FROM app_config WHERE key LIKE 'GOOGLE_%'")
            conn.commit()
        settings.GOOGLE_CLIENT_ID = orig_cid
        settings.GOOGLE_CLIENT_SECRET = orig_csec
