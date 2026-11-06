"""
Unit and integration tests for REGRAVA Security Posture & Health service.
Verifies calculation of 7-layer security checks, health scores, and API responses.
"""

import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.db.session_db import db

client = TestClient(app)


@pytest.fixture
def demo_auth_headers():
    res = client.post("/api/auth/demo-login")
    assert res.status_code == 200
    token = res.json()["token"]
    return {"Cookie": f"regrava_session={token}"}


def test_security_posture_endpoint(demo_auth_headers):
    # Ensure there's at least one scan so metrics populate
    res_analyze = client.post(
        "/api/repos/demo-org/payment-service/pulls/42/analyze",
        headers=demo_auth_headers,
    )
    assert res_analyze.status_code in (200, 201)

    # Fetch security posture
    res = client.get("/api/security/posture", headers=demo_auth_headers)
    assert res.status_code == 200
    data = res.json()

    # Validate Fleet-level metrics
    assert "average_health_score" in data
    assert "fleet_grade" in data
    assert "total_repositories" in data
    assert "category_distribution" in data
    assert "compliance_readiness" in data
    assert "repositories" in data

    assert data["total_repositories"] >= 1
    assert data["total_checks_evaluated"] > 0

    # Validate individual Repository Security Health structure
    repos = data["repositories"]
    assert len(repos) > 0
    repo = repos[0]

    assert "repo_name" in repo
    assert "health_score" in repo
    assert 0 <= repo["health_score"] <= 100
    assert repo["health_grade"] in ["A+", "A", "B", "C", "D", "F"]
    assert "checks" in repo
    assert len(repo["checks"]) == 7  # Exactly 7 layers!

    # Check the 7 layers
    check_ids = [c["id"] for c in repo["checks"]]
    assert "secrets" in check_ids
    assert "injection" in check_ids
    assert "authorization" in check_ids
    assert "input_validation" in check_ids
    assert "configuration" in check_ids
    assert "dependency" in check_ids
    assert "api_contract" in check_ids

    for c in repo["checks"]:
        assert c["status"] in ["passed", "warning", "failed", "pending"]
        assert "name" in c
        assert "description" in c


def test_security_audit_endpoint(demo_auth_headers):
    res = client.post(
        "/api/security/audit/demo-org/payment-service",
        headers=demo_auth_headers,
    )
    assert res.status_code in (200, 201)
    data = res.json()

    assert data["status"] == "audited"
    assert data["repo_full_name"] == "demo-org/payment-service"
    assert "health_score" in data
    assert "repo_health" in data


def test_individual_repository_security_endpoint(demo_auth_headers):
    res = client.get(
        "/api/security/repository/demo-org/payment-service",
        headers=demo_auth_headers,
    )
    assert res.status_code == 200
    data = res.json()

    assert data["repo_full_name"] == "demo-org/payment-service"
    assert "health_score" in data
    assert "health_grade" in data
    assert "checks" in data
    assert len(data["checks"]) == 7
    assert "open_findings" in data

