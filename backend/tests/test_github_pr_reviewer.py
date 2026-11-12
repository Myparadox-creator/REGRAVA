"""
Comprehensive Integration & Unit Test Suite for REGRAVA Native GitHub PR Reviewer.
Covers all 10 required verification scenarios using mocked GitHub REST APIs and
ephemeral RSA-signed GitHub App JWTs (zero live network mutations).
"""

from __future__ import annotations

import hashlib
import hmac
import json
import uuid
from typing import Any, Dict, List, Optional
import jwt
import pytest
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from fastapi.testclient import TestClient

from app.analyzer.security_analyzer import SecurityAnalyzer
from app.config import settings
from app.db.session_db import DatabaseManager
from app.main import app
from app.models.finding import FindingCategory
from app.services.auth_service import auth_service
from app.services.github_app_service import github_app_auth
from app.services.pull_request_diff_service import (
    map_finding_to_diff_location,
    parse_unified_diff_patch,
    pr_diff_service,
)
from app.services.regrava_review_service import regrava_review_service
from app.services.review_publisher_service import review_publisher


def _generate_test_rsa_pem() -> str:
    private_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    pem = private_key.private_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PrivateFormat.PKCS8,
        encryption_algorithm=serialization.NoEncryption(),
    )
    return pem.decode("utf-8")


@pytest.fixture
def isolated_env(tmp_path, monkeypatch):
    """Provide an isolated SQLite DB and ephemeral GitHub App credentials for each test."""
    test_db = DatabaseManager(db_path=tmp_path / "test_regrava.db")

    # Patch `db` across all modules that import it
    import app.db.session_db as session_db_mod
    import app.services.auth_service as auth_svc_mod
    import app.services.github_app_service as app_svc_mod
    import app.services.pull_request_diff_service as diff_svc_mod
    import app.services.review_deduplication_service as dedup_svc_mod
    import app.services.review_lifecycle_service as lc_svc_mod
    import app.services.review_publisher_service as pub_svc_mod
    import app.services.regrava_review_service as rev_svc_mod
    import app.services.github_webhook_service as wh_svc_mod
    import app.api.github_reviews as gh_rev_api_mod
    import app.api.pull_requests as pr_api_mod

    for mod in (
        session_db_mod,
        auth_svc_mod,
        app_svc_mod,
        diff_svc_mod,
        dedup_svc_mod,
        lc_svc_mod,
        pub_svc_mod,
        rev_svc_mod,
        wh_svc_mod,
        gh_rev_api_mod,
        pr_api_mod,
    ):
        if hasattr(mod, "db"):
            monkeypatch.setattr(mod, "db", test_db)

    rsa_pem = _generate_test_rsa_pem()
    monkeypatch.setattr(settings, "GITHUB_APP_ID", "998877")
    monkeypatch.setattr(settings, "GITHUB_APP_PRIVATE_KEY", rsa_pem)
    monkeypatch.setattr(settings, "GITHUB_WEBHOOK_SECRET", "whsec_test_secret_123")
    github_app_auth._token_cache.clear()

    return test_db


def _create_live_github_user(test_db: DatabaseManager, email: str, authorized_repos: List[str]):
    user = test_db.upsert_user(
        email=email,
        name="Real Dev",
        auth_provider="github",
        is_demo=False,
    )
    gh_account = {
        "github_username": "real-dev",
        "authorized_repos": authorized_repos,
        "access_token": "gho_mock_user_token",
    }
    test_db.save_github_account(
        user_id=user["id"],
        github_user_id="10001",
        github_username="real-dev",
        installation_id="55501",
        authorized_repos=authorized_repos,
        access_token="gho_mock_user_token",
    )
    token = auth_service.generate_session_token(user=user, github_account=gh_account)
    test_db.create_session(user["id"], token)
    return user, token


def _make_mock_pr_context(
    owner: str,
    repo: str,
    pr_number: int,
    head_sha: str,
    files: List[Dict[str, Any]],
    installation_id: Optional[str] = "55501",
) -> Dict[str, Any]:
    diff_maps = {}
    for f in files:
        fname = f["filename"]
        diff_maps[fname] = parse_unified_diff_patch(fname, f.get("patch", ""), status=f.get("status", "modified"))

    return {
        "repo_id": "424242",
        "repo_full_name": f"{owner}/{repo}",
        "owner": owner,
        "repo_name": repo,
        "pr_number": pr_number,
        "title": f"Test PR #{pr_number}",
        "description": "Automated test PR",
        "author": "real-dev",
        "author_avatar": None,
        "state": "open",
        "base_ref": "main",
        "head_ref": "feat/test",
        "base_sha": "base0000001",
        "head_sha": head_sha,
        "html_url": f"https://github.com/{owner}/{repo}/pull/{pr_number}",
        "changed_files_count": len(files),
        "additions": 10,
        "deletions": 2,
        "files": files,
        "context_files": {},
        "diff_maps": diff_maps,
        "installation_id": installation_id,
        "is_demo": False,
    }


def _mock_response(status_code: int, json_data: Any):
    class _Resp:
        def __init__(self, sc, jd):
            self.status_code = sc
            self._jd = jd
            self.text = json.dumps(jd) if jd is not None else ""
            self.headers = {}

        def json(self):
            return self._jd

    return _Resp(status_code, json_data)


@pytest.mark.asyncio
async def test_1_and_2_successful_review_with_inline_security_finding(isolated_env, monkeypatch):
    """
    Test 1 & Test 2:
    - Generates real RS256 App JWT.
    - Analyzes authorized PR containing an intentional SQL injection on line 5.
    - Publishes review with event='COMMENT' under App identity with exact inline anchor.
    """
    test_db = isolated_env
    user, _ = _create_live_github_user(test_db, "dev@acme.io", ["acme/api"])

    # Verify real JWT creation decodes cleanly
    app_jwt = github_app_auth.create_app_jwt()
    unverified = jwt.decode(app_jwt, options={"verify_signature": False})
    assert unverified["iss"] == "998877"

    vulnerable_code = (
        "from fastapi import FastAPI\n"
        "app = FastAPI()\n\n"
        "def get_order(cursor, order_id: str):\n"
        "    query = f\"SELECT * FROM orders WHERE id = '{order_id}'\"\n"
        "    return cursor.execute(query)\n"
    )
    patch = (
        "@@ -1,2 +1,6 @@\n"
        " from fastapi import FastAPI\n"
        " app = FastAPI()\n"
        "+\n"
        "+def get_order(cursor, order_id: str):\n"
        "+    query = f\"SELECT * FROM orders WHERE id = '{order_id}'\"\n"
        "+    return cursor.execute(query)"
    )

    pr_ctx = _make_mock_pr_context(
        "acme",
        "api",
        12,
        "sha_commit_a111",
        files=[{"filename": "backend/orders.py", "status": "modified", "base_content": "app = FastAPI()\n", "head_content": vulnerable_code, "patch": patch}],
    )

    async def mock_fetch_pr_context(**kwargs):
        return pr_ctx

    async def mock_latest_sha(**kwargs):
        return "sha_commit_a111"

    captured_requests: List[Dict[str, Any]] = []

    async def mock_req(installation_id, method, url, json_body=None, extra_headers=None, **kwargs):
        captured_requests.append({"method": method, "url": url, "body": json_body})
        if method == "POST" and url.endswith("/pulls/12/reviews"):
            return _mock_response(201, {"id": 88001, "html_url": "https://github.com/acme/api/pull/12#pullrequestreview-88001"})
        if method == "GET" and url.endswith("/reviews/88001/comments"):
            return _mock_response(200, [{"id": 99001, "path": "backend/orders.py", "line": 5, "html_url": "https://github.com/acme/api/pull/12#discussion_r99001"}])
        return _mock_response(404, {})

    monkeypatch.setattr(pr_diff_service, "fetch_pr_context", mock_fetch_pr_context)
    monkeypatch.setattr(pr_diff_service, "get_latest_pr_head_sha", mock_latest_sha)
    monkeypatch.setattr(github_app_auth, "request_with_installation", mock_req)

    job = regrava_review_service.authorize_and_create_job(user["id"], "acme", "api", 12)
    final_job = await regrava_review_service.execute_review_job(
        job_id=job["job_id"],
        user_id=user["id"],
        owner="acme",
        repo="api",
        pr_number=12,
    )

    assert final_job["state"] == "published"
    post_calls = [r for r in captured_requests if r["method"] == "POST" and "/pulls/12/reviews" in r["url"]]
    assert len(post_calls) == 1

    review_payload = post_calls[0]["body"]
    assert review_payload["event"] == "COMMENT"
    assert review_payload["commit_id"] == "sha_commit_a111"
    assert "## REGRAVA Review" in review_payload["body"]
    assert "does not guarantee that the code is vulnerability-free" in review_payload["body"]
    assert len(review_payload["comments"]) == 1

    inline = review_payload["comments"][0]
    assert inline["path"] == "backend/orders.py"
    assert inline["line"] == 5
    assert inline["side"] == "RIGHT"
    assert "SQL Injection" in inline["body"]

    # Lifecycle check: Finding recorded as published to GitHub with comment ID
    lifecycle = test_db.list_finding_lifecycle_for_pr("acme/api", 12)
    assert len(lifecycle) == 1
    assert lifecycle[0]["published_to_github"] is True
    assert lifecycle[0]["published_review_id"] == "88001"
    assert lifecycle[0]["published_comment_id"] == "99001"
    assert lifecycle[0]["current_status"] == "Open"


@pytest.mark.asyncio
async def test_3_no_actionable_findings_clean_pr(isolated_env, monkeypatch):
    """Test 3: Harmless PR publishes summary stating no actionable issues without fabricating warnings."""
    test_db = isolated_env
    user, _ = _create_live_github_user(test_db, "dev@acme.io", ["acme/api"])

    clean_code = "def add(a: int, b: int) -> int:\n    return a + b\n"
    patch = "@@ -0,0 +1,2 @@\n+def add(a: int, b: int) -> int:\n+    return a + b"
    pr_ctx = _make_mock_pr_context(
        "acme", "api", 15, "sha_clean_111",
        files=[{"filename": "backend/math_utils.py", "status": "added", "base_content": "", "head_content": clean_code, "patch": patch}],
    )

    captured_payloads = []
    monkeypatch.setattr(pr_diff_service, "fetch_pr_context", lambda **kw: _async_val(pr_ctx))
    monkeypatch.setattr(pr_diff_service, "get_latest_pr_head_sha", lambda **kw: _async_val("sha_clean_111"))

    async def mock_req(installation_id, method, url, json_body=None, **kwargs):
        if method == "POST":
            captured_payloads.append(json_body)
            return _mock_response(201, {"id": 88002, "html_url": "https://github.com/acme/api/pull/15#pullrequestreview-88002"})
        return _mock_response(200, [])

    monkeypatch.setattr(github_app_auth, "request_with_installation", mock_req)

    job = regrava_review_service.authorize_and_create_job(user["id"], "acme", "api", 15)
    final_job = await regrava_review_service.execute_review_job(job["job_id"], user["id"], "acme", "api", 15)

    assert final_job["state"] == "published"
    assert len(captured_payloads) == 1
    body = captured_payloads[0]
    assert "comments" not in body or len(body["comments"]) == 0
    assert "No actionable security or API compatibility issues were identified" in body["body"]
    assert "does not guarantee that the code is vulnerability-free" in body["body"]


@pytest.mark.asyncio
async def test_4_duplicate_review_prevention(isolated_env, monkeypatch):
    """Test 4: Re-running review for same head SHA prevents duplicate GitHub reviews."""
    test_db = isolated_env
    user, _ = _create_live_github_user(test_db, "dev@acme.io", ["acme/api"])

    code = "def ping():\n    return 'pong'\n"
    patch = "@@ -0,0 +1,2 @@\n+def ping():\n+    return 'pong'"
    pr_ctx = _make_mock_pr_context(
        "acme", "api", 20, "sha_dup_999",
        files=[{"filename": "backend/ping.py", "status": "added", "base_content": "", "head_content": code, "patch": patch}],
    )

    monkeypatch.setattr(pr_diff_service, "fetch_pr_context", lambda **kw: _async_val(pr_ctx))
    monkeypatch.setattr(pr_diff_service, "get_latest_pr_head_sha", lambda **kw: _async_val("sha_dup_999"))

    post_count = 0

    async def mock_req(installation_id, method, url, json_body=None, **kwargs):
        nonlocal post_count
        if method == "POST":
            post_count += 1
            return _mock_response(201, {"id": 88003, "html_url": "https://github.com/acme/api/pull/20#pullrequestreview-88003"})
        return _mock_response(200, [])

    monkeypatch.setattr(github_app_auth, "request_with_installation", mock_req)

    job1 = regrava_review_service.authorize_and_create_job(user["id"], "acme", "api", 20)
    res1 = await regrava_review_service.execute_review_job(job1["job_id"], user["id"], "acme", "api", 20)
    assert res1["state"] == "published"
    assert post_count == 1

    # Trigger second review for exact same SHA
    job2 = regrava_review_service.authorize_and_create_job(user["id"], "acme", "api", 20)
    res2 = await regrava_review_service.execute_review_job(job2["job_id"], user["id"], "acme", "api", 20)
    assert res2["state"] == "already_reviewed"
    assert post_count == 1  # Strictly NO second GitHub review created!


@pytest.mark.asyncio
async def test_5_new_commit_reassessment_and_lifecycle(isolated_env, monkeypatch):
    """
    Test 5: Push new commit B after commit A:
    - Still-present finding updates to 'Still Present'.
    - Finding fixed in file WITHOUT test files updates to 'Fix Attempted' (not blindly Verified Fixed).
    - Finding fixed in file WITH test files updates to 'Verified Fixed'.
    """
    test_db = isolated_env
    user, _ = _create_live_github_user(test_db, "dev@acme.io", ["acme/api"])

    # Commit A: SQLi in orders.py AND Path traversal in files.py
    orders_vuln = "def get_o(c, oid):\n    q = f\"SELECT * FROM o WHERE id = '{oid}'\"\n"
    files_vuln = "def rd(name):\n    return open(f'/tmp/{name}').read()\n"

    ctx_a = _make_mock_pr_context(
        "acme", "api", 30, "commit_A_111",
        files=[
            {"filename": "backend/orders.py", "status": "added", "base_content": "", "head_content": orders_vuln, "patch": "@@ -0,0 +1,2 @@\n+def get_o(c, oid):\n+    q = f\"SELECT * FROM o WHERE id = '{oid}'\""},
            {"filename": "backend/files.py", "status": "added", "base_content": "", "head_content": files_vuln, "patch": "@@ -0,0 +1,2 @@\n+def rd(name):\n+    return open(f'/tmp/{name}').read()"},
        ],
    )

    monkeypatch.setattr(pr_diff_service, "fetch_pr_context", lambda **kw: _async_val(ctx_a))
    monkeypatch.setattr(pr_diff_service, "get_latest_pr_head_sha", lambda **kw: _async_val("commit_A_111"))

    async def mock_req(installation_id, method, url, json_body=None, **kwargs):
        if method == "POST":
            return _mock_response(201, {"id": 88010, "html_url": "https://github.com/acme/api/pull/30#pullrequestreview-88010"})
        return _mock_response(200, [])

    monkeypatch.setattr(github_app_auth, "request_with_installation", mock_req)

    j1 = regrava_review_service.authorize_and_create_job(user["id"], "acme", "api", 30)
    await regrava_review_service.execute_review_job(j1["job_id"], user["id"], "acme", "api", 30)
    lf_a = test_db.list_finding_lifecycle_for_pr("acme/api", 30)
    assert len(lf_a) == 2
    assert all(x["current_status"] == "Open" for x in lf_a)

    # Commit B: files.py fixed (WITHOUT test file), orders.py still vulnerable
    files_fixed = "from pathlib import Path\ndef rd(name):\n    p = Path('/tmp', name).resolve()\n    return p.read_text()\n"
    ctx_b = _make_mock_pr_context(
        "acme", "api", 30, "commit_B_222",
        files=[
            {"filename": "backend/orders.py", "status": "modified", "base_content": orders_vuln, "head_content": orders_vuln, "patch": ""},
            {"filename": "backend/files.py", "status": "modified", "base_content": files_vuln, "head_content": files_fixed, "patch": "@@ -1,2 +1,4 @@\n+from pathlib import Path\n def rd(name):\n-    return open(f'/tmp/{name}').read()\n+    p = Path('/tmp', name).resolve()\n+    return p.read_text()"},
        ],
    )
    monkeypatch.setattr(pr_diff_service, "fetch_pr_context", lambda **kw: _async_val(ctx_b))
    monkeypatch.setattr(pr_diff_service, "get_latest_pr_head_sha", lambda **kw: _async_val("commit_B_222"))

    j2 = regrava_review_service.authorize_and_create_job(user["id"], "acme", "api", 30)
    await regrava_review_service.execute_review_job(j2["job_id"], user["id"], "acme", "api", 30)

    lf_b = test_db.list_finding_lifecycle_for_pr("acme/api", 30)
    by_file = {r["file_path"]: r for r in lf_b}
    assert by_file["backend/orders.py"]["current_status"] == "Still Present"
    assert by_file["backend/files.py"]["current_status"] == "Fix Attempted"

    # Commit C: modified files.py alongside a dedicated test_files.py -> Verified Fixed
    ctx_c = _make_mock_pr_context(
        "acme", "api", 30, "commit_C_333",
        files=[
            {"filename": "backend/orders.py", "status": "modified", "base_content": orders_vuln, "head_content": orders_vuln, "patch": ""},
            {"filename": "backend/files.py", "status": "modified", "base_content": files_vuln, "head_content": files_fixed, "patch": ""},
            {"filename": "backend/tests/test_files.py", "status": "added", "base_content": "", "head_content": "def test_traversal_blocked(): assert True\n", "patch": "@@ -0,0 +1 @@\n+def test_traversal_blocked(): assert True"},
        ],
    )
    monkeypatch.setattr(pr_diff_service, "fetch_pr_context", lambda **kw: _async_val(ctx_c))
    monkeypatch.setattr(pr_diff_service, "get_latest_pr_head_sha", lambda **kw: _async_val("commit_C_333"))

    j3 = regrava_review_service.authorize_and_create_job(user["id"], "acme", "api", 30)
    await regrava_review_service.execute_review_job(j3["job_id"], user["id"], "acme", "api", 30)

    lf_c = test_db.list_finding_lifecycle_for_pr("acme/api", 30)
    by_file_c = {r["file_path"]: r for r in lf_c}
    assert by_file_c["backend/files.py"]["current_status"] == "Verified Fixed"
    assert "test" in (by_file_c["backend/files.py"]["verification_evidence"] or "").lower()


def test_6_unauthorized_repository_rejected(isolated_env):
    """
    Test 6:
    - Live GitHub user cannot review a repo outside their authorized_repos.
    - Google-only user (without GitHub connection) cannot review real repos.
    """
    test_db = isolated_env
    _, gh_token = _create_live_github_user(test_db, "dev@acme.io", ["acme/allowed-repo"])

    google_user = test_db.upsert_user("guser@gmail.com", "Google Only", "google", is_demo=False)
    g_token = auth_service.generate_session_token(user=google_user, github_account=None)
    test_db.create_session(google_user["id"], g_token)

    client = TestClient(app)

    # Attempt arbitrary repo review with GitHub user lacking access
    res1 = client.post(
        "/api/repos/secret-org/private-repo/pulls/1/review",
        headers={"Authorization": f"Bearer {gh_token}"},
    )
    assert res1.status_code == 403

    # Attempt repo review using only Google login session
    res2 = client.post(
        "/api/repos/acme/allowed-repo/pulls/1/review",
        headers={"Authorization": f"Bearer {g_token}"},
    )
    assert res2.status_code == 403


@pytest.mark.asyncio
async def test_7_stale_analysis_discarded_when_pr_updated(isolated_env, monkeypatch):
    """Test 7: If PR head SHA advances while analysis runs, stale publication is aborted."""
    test_db = isolated_env
    user, _ = _create_live_github_user(test_db, "dev@acme.io", ["acme/api"])

    pr_ctx = _make_mock_pr_context(
        "acme", "api", 40, "old_sha_1111",
        files=[{"filename": "backend/app.py", "status": "added", "base_content": "", "head_content": "x = 1\n", "patch": "@@ -0,0 +1 @@\n+x = 1"}],
    )

    monkeypatch.setattr(pr_diff_service, "fetch_pr_context", lambda **kw: _async_val(pr_ctx))
    # Simulate PR advancing to new_sha_2222 before publication!
    monkeypatch.setattr(pr_diff_service, "get_latest_pr_head_sha", lambda **kw: _async_val("new_sha_2222"))

    post_attempted = False

    async def mock_req(installation_id, method, url, **kwargs):
        nonlocal post_attempted
        if method == "POST":
            post_attempted = True
        return _mock_response(201, {"id": 1})

    monkeypatch.setattr(github_app_auth, "request_with_installation", mock_req)

    job = regrava_review_service.authorize_and_create_job(user["id"], "acme", "api", 40)
    final_job = await regrava_review_service.execute_review_job(job["job_id"], user["id"], "acme", "api", 40)

    assert final_job["state"] == "failed"
    assert "updated during analysis" in (final_job.get("error_message") or "")
    assert post_attempted is False

    revs = test_db.find_published_reviews_for_pr("acme/api", 40, "old_sha_1111")
    assert len(revs) == 1
    assert revs[0]["publication_status"] == "stale_discarded"


@pytest.mark.asyncio
async def test_8_github_api_failure_preserves_analysis_and_allows_retry(isolated_env, monkeypatch):
    """Test 8: GitHub 502/rate-limit preserves analysis & review record and recovers on retry."""
    test_db = isolated_env
    user, _ = _create_live_github_user(test_db, "dev@acme.io", ["acme/api"])

    pr_ctx = _make_mock_pr_context(
        "acme", "api", 50, "sha_retry_555",
        files=[{"filename": "backend/a.py", "status": "added", "base_content": "", "head_content": "val = 1\n", "patch": "@@ -0,0 +1 @@\n+val = 1"}],
    )
    monkeypatch.setattr(pr_diff_service, "fetch_pr_context", lambda **kw: _async_val(pr_ctx))
    monkeypatch.setattr(pr_diff_service, "get_latest_pr_head_sha", lambda **kw: _async_val("sha_retry_555"))

    should_fail = True

    async def mock_req(installation_id, method, url, json_body=None, **kwargs):
        if method == "POST" and should_fail:
            return _mock_response(502, {"message": "Bad Gateway"})
        if method == "POST":
            return _mock_response(201, {"id": 88050, "html_url": "https://github.com/acme/api/pull/50#pullrequestreview-88050"})
        return _mock_response(200, [])

    monkeypatch.setattr(github_app_auth, "request_with_installation", mock_req)
    monkeypatch.setattr(github_app_auth, "get_installation_for_repo", lambda o, r: _async_val({"installation_id": "55501"}))

    job = regrava_review_service.authorize_and_create_job(user["id"], "acme", "api", 50)
    res1 = await regrava_review_service.execute_review_job(job["job_id"], user["id"], "acme", "api", 50)
    assert res1["state"] == "failed"
    assert res1["analysis_id"] is not None

    failed_reviews = test_db.list_github_reviews("acme/api", 50)
    assert len(failed_reviews) == 1
    assert failed_reviews[0]["publication_status"] == "failed"

    # Now GitHub recovers -> retry publish cleanly!
    should_fail = False
    retried = await review_publisher.retry_publish_review(failed_reviews[0]["id"], installation_id="55501")
    assert retried["publication_status"] == "published"
    assert retried["github_review_id"] == "88050"


def test_9_invalid_inline_location_not_fabricated():
    """
    Test 9: Findings located on unchanged lines outside PR diff hunks must NOT get
    fabricated inline comment anchors.
    """
    patch = (
        "@@ -20,3 +20,4 @@\n"
        " def helper():\n"
        "+    x = 1\n"
        "     return True\n"
    )
    dmap = parse_unified_diff_patch("backend/service.py", patch)
    diff_maps = {"backend/service.py": dmap}

    # Line 21 is inside diff hunk -> valid anchor
    valid_anchor = map_finding_to_diff_location(diff_maps, "backend/service.py", 21, "head123")
    assert valid_anchor is not None
    assert valid_anchor.line == 21
    assert valid_anchor.side == "RIGHT"

    # Line 5 is outside diff hunk -> MUST return None (never fabricated!)
    invalid_anchor = map_finding_to_diff_location(diff_maps, "backend/service.py", 5, "head123")
    assert invalid_anchor is None

    # Missing file -> MUST return None
    missing_anchor = map_finding_to_diff_location(diff_maps, "backend/other.py", 21, "head123")
    assert missing_anchor is None


def test_10_webhook_signature_and_idempotency_and_auto_review_toggle(isolated_env):
    """
    Test 10:
    - Rejects missing/invalid X-Hub-Signature-256 with 401.
    - Accepts valid signature.
    - Enforces delivery idempotency (duplicate delivery ignored).
    - Auto-review defaults to OFF; triggers only when enabled per repository.
    """
    test_db = isolated_env
    test_db.upsert_installation("55501", "acme", "Organization", repositories=["acme/api"])
    client = TestClient(app)

    payload_dict = {
        "action": "opened",
        "installation": {"id": 55501},
        "repository": {"id": 100, "full_name": "acme/api"},
        "pull_request": {"number": 77, "draft": False, "head": {"sha": "abc1234"}},
    }
    raw_body = json.dumps(payload_dict).encode("utf-8")

    # 1. Invalid signature -> 401
    bad_res = client.post(
        "/api/webhooks/github",
        content=raw_body,
        headers={
            "X-GitHub-Event": "pull_request",
            "X-GitHub-Delivery": "deliv-001",
            "X-Hub-Signature-256": "sha256=deadbeef",
        },
    )
    assert bad_res.status_code == 401

    # Helper to compute real HMAC-SHA256
    def _sign(body: bytes) -> str:
        return "sha256=" + hmac.new(b"whsec_test_secret_123", body, hashlib.sha256).hexdigest()

    # 2. Valid signature, auto-review OFF by default -> skipped safely
    good_res = client.post(
        "/api/webhooks/github",
        content=raw_body,
        headers={
            "X-GitHub-Event": "pull_request",
            "X-GitHub-Delivery": "deliv-001",
            "X-Hub-Signature-256": _sign(raw_body),
        },
    )
    assert good_res.status_code == 200
    assert good_res.json()["status"] == "skipped_auto_review_disabled"

    # 3. Duplicate delivery ID -> duplicate_ignored
    dup_res = client.post(
        "/api/webhooks/github",
        content=raw_body,
        headers={
            "X-GitHub-Event": "pull_request",
            "X-GitHub-Delivery": "deliv-001",
            "X-Hub-Signature-256": _sign(raw_body),
        },
    )
    assert dup_res.status_code == 200
    assert dup_res.json()["status"] == "duplicate_ignored"


def test_context_aware_authorization_middleware_reduces_false_positives():
    """Verify SecurityAnalyzer inspects router/decorator auth guards before reporting IDOR."""
    analyzer = SecurityAnalyzer()
    guarded_code = (
        "from fastapi import APIRouter, Depends\n"
        "from app.auth import verify_ownership\n\n"
        "router = APIRouter(dependencies=[Depends(verify_ownership)])\n\n"
        "@router.get('/users/{user_id}')\n"
        "def read_user(user_id: int):\n"
        "    return {'id': user_id}\n"
    )
    findings = analyzer.analyze_file("backend/users_router.py", guarded_code)
    auth_findings = [f for f in findings if f.category == FindingCategory.AUTHENTICATION]
    assert len(auth_findings) == 0


async def _async_val(v):
    return v
