"""
Unit and integration tests for REGRAVA authentication, session handling,
and Google/GitHub OAuth state verification.
"""

from fastapi.testclient import TestClient
from app.main import app
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
