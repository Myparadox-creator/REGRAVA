"""
Automated Test Suite for REGRAVA Issue Sentinel.
Verifies:
1. Claim and context extraction from issue title and body.
2. Grounding against codebase AST:
   - ALREADY_IMPLEMENTED: Endpoint / function already exists in code.
   - NON_EXISTENT_CONTEXT: Issue references files / tech that do not exist (hallucinated / spam).
   - VALID_OPEN_ISSUE: Genuine security finding or unaddressed bug.
   - NEEDS_MORE_INFO: Underspecified questions or vague text.
3. Action execution and automated issue closing.
4. Issue reopening via maintainer override.
5. REST API endpoints (/api/repos/{owner}/{repo}/issues, triage, stats, settings).
6. Webhook triggers for issues.opened and issue_comment @regrava reopen.
"""

import uuid
import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.db.session_db import db
from app.services.github_service import DEMO_ISSUES
from app.services.issue_verifier_service import issue_verifier_service
from app.services.issue_action_service import issue_action_service
from app.services.github_webhook_service import github_webhook_service


@pytest.fixture
def client():
    return TestClient(app)


@pytest.fixture
def auth_headers(client):
    """Authenticate via demo-login to acquire a valid session cookie."""
    res = client.post("/api/auth/demo-login")
    assert res.status_code == 200
    return res.cookies


def test_1_extract_claims():
    title = "feat: Add endpoint to download payment receipts"
    body = "Please add an endpoint `/api/receipts/download` or `download_receipt` in `backend/routes/payment.py`."
    claims = issue_verifier_service.extract_claims(title, body)

    assert "backend/routes/payment.py" in claims["files"]
    assert "/api/receipts/download" in claims["routes"]
    assert "download_receipt" in claims["symbols"]
    assert claims["is_feature"] is True
    assert claims["is_security"] is False


@pytest.mark.asyncio
async def test_2_detect_already_implemented_issue():
    issue = {
        "number": 101,
        "title": "feat: Add endpoint to download payment receipts",
        "body": "It would be great to have an endpoint like `/api/receipts/download` or `download_receipt` handler that reads receipts.",
        "author": "open-contributor-42",
    }
    triage = await issue_verifier_service.verify_issue("demo-org/payment-service", issue)

    assert triage["classification"] == "ALREADY_IMPLEMENTED"
    assert triage["confidence"] == "HIGH"
    assert triage["auto_close_eligible"] is True
    assert len(triage["evidence"]) >= 1
    assert triage["evidence"][0]["file_path"] == "backend/routes/payment.py"
    assert triage["evidence"][0]["line_start"] > 0
    assert "download_receipt" in triage["evidence"][0]["code_snippet"]


@pytest.mark.asyncio
async def test_3_detect_non_existent_context_issue():
    issue = {
        "number": 102,
        "title": "bug: NullPointerException in PaymentsLegacyHelper.java line 85",
        "body": "Running customer billing throws a NullPointerException in `src/main/java/com/payments/PaymentsLegacyHelper.java` at line 85.",
        "author": "spam-bot-bot",
    }
    triage = await issue_verifier_service.verify_issue("demo-org/payment-service", issue)

    assert triage["classification"] == "NON_EXISTENT_CONTEXT"
    assert triage["confidence"] == "HIGH"
    assert triage["auto_close_eligible"] is True
    assert len(triage["evidence"]) >= 1
    assert "PaymentsLegacyHelper.java" in triage["evidence"][0]["referenced_files"][0]


@pytest.mark.asyncio
async def test_4_detect_valid_open_security_issue():
    issue = {
        "number": 103,
        "title": "security: Path traversal in /api/receipts/download allows arbitrary file read",
        "body": "In `backend/routes/payment.py`, the `download_receipt` function opens `f'/var/receipts/{filename}'` without validation.",
        "author": "security-researcher-pro",
    }
    triage = await issue_verifier_service.verify_issue("demo-org/payment-service", issue)

    assert triage["classification"] == "VALID_OPEN_ISSUE"
    assert triage["confidence"] == "HIGH"
    assert triage["auto_close_eligible"] is False
    assert len(triage["evidence"]) >= 1
    assert "Path Traversal" in triage["evidence"][0]["vulnerability_type"]


@pytest.mark.asyncio
async def test_5_detect_needs_more_info():
    issue = {
        "number": 104,
        "title": "question: How to configure",
        "body": "Could someone explain?",
        "author": "newbie-coder",
    }
    triage = await issue_verifier_service.verify_issue("demo-org/payment-service", issue)

    assert triage["classification"] == "NEEDS_MORE_INFO"
    assert triage["auto_close_eligible"] is False


@pytest.mark.asyncio
async def test_6_execute_triage_and_auto_close():
    # Reset issue 101 state
    for item in DEMO_ISSUES["demo-org/payment-service"]:
        if item["number"] == 101:
            item["state"] = "open"

    res = await issue_action_service.execute_triage(
        repo_full_name="demo-org/payment-service",
        issue_number=101,
        auto_close_override=True,
    )

    assert res["classification"] == "ALREADY_IMPLEMENTED"
    assert res["action_taken"] == "CLOSED"
    assert res["github_comment_id"] is not None
    assert "REGRAVA Issue Sentinel Analysis" in res["comment_body"]

    # Verify state updated in demo repo
    for item in DEMO_ISSUES["demo-org/payment-service"]:
        if item["number"] == 101:
            assert item["state"] == "closed"

    # Verify stored in DB
    record = db.get_issue_triage("demo-org/payment-service", 101)
    assert record is not None
    assert record["classification"] == "ALREADY_IMPLEMENTED"
    assert record["action_taken"] == "CLOSED"


@pytest.mark.asyncio
async def test_7_reopen_issue_workflow():
    reopen_res = await issue_action_service.reopen_issue(
        repo_full_name="demo-org/payment-service",
        issue_number=101,
        reopened_by="maintainer_alice",
    )
    assert reopen_res["status"] == "reopened"

    # Check demo state is now open
    for item in DEMO_ISSUES["demo-org/payment-service"]:
        if item["number"] == 101:
            assert item["state"] == "open"

    record = db.get_issue_triage("demo-org/payment-service", 101)
    assert record["action_taken"] == "REOPENED"


def test_8_issues_api_endpoints(client, auth_headers):
    # 1. List issues
    res = client.get("/api/repos/demo-org/payment-service/issues", cookies=auth_headers)
    assert res.status_code == 200
    issues = res.json()
    assert len(issues) >= 4
    assert any(i["number"] == 101 for i in issues)

    # 2. Get single issue
    res = client.get("/api/repos/demo-org/payment-service/issues/101", cookies=auth_headers)
    assert res.status_code == 200
    assert res.json()["number"] == 101

    # 3. Trigger triage via API
    res = client.post(
        "/api/repos/demo-org/payment-service/issues/102/triage",
        json={"auto_close": True, "dry_run": False},
        cookies=auth_headers,
    )
    assert res.status_code == 200
    triage_data = res.json()
    assert triage_data["classification"] == "NON_EXISTENT_CONTEXT"
    assert triage_data["action_taken"] == "CLOSED"

    # 4. Get stats
    res = client.get("/api/issues/stats", cookies=auth_headers)
    assert res.status_code == 200
    stats = res.json()
    assert stats["total_triaged"] >= 1
    assert stats["hours_saved"] >= 0.7

    # 5. Get and update repo settings
    res = client.get("/api/repos/demo-org/payment-service/issues/settings", cookies=auth_headers)
    assert res.status_code == 200
    settings_data = res.json()
    assert "enabled" in settings_data

    res = client.post(
        "/api/repos/demo-org/payment-service/issues/settings",
        json={"enabled": True, "auto_close": True, "mode": "comment_and_close"},
        cookies=auth_headers,
    )
    assert res.status_code == 200
    assert res.json()["auto_close"] is True


@pytest.mark.asyncio
async def test_9_webhook_issues_opened_triggers_triage():
    payload = {
        "action": "opened",
        "repository": {"full_name": "demo-org/payment-service"},
        "issue": {"number": 101, "title": "feat: Add endpoint to download payment receipts"},
    }
    res = await github_webhook_service.process_event(
        event_type="issues",
        delivery_id=f"deliv-test-issue-opened-{uuid.uuid4()}",
        payload=payload,
        run_sync=True,
    )
    assert res["status"] == "issue_triaged"
    assert res["issue_number"] == 101


@pytest.mark.asyncio
async def test_10_webhook_issue_comment_reopen():
    payload = {
        "action": "created",
        "repository": {"full_name": "demo-org/payment-service"},
        "issue": {"number": 102},  # not a PR
        "comment": {"body": "@regrava reopen please this was a mistake", "user": {"login": "senior-eng"}},
    }
    res = await github_webhook_service.process_event(
        event_type="issue_comment",
        delivery_id=f"deliv-test-issue-reopen-{uuid.uuid4()}",
        payload=payload,
        run_sync=True,
    )
    assert res["status"] == "issue_reopened"
    assert res["issue_number"] == 102
