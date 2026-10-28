"""
Tests for FastAPI API endpoints.
"""

from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_health_endpoint():
    res = client.get("/api/health")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "ok"
    assert "RepoSentinel" in data["service"]


def test_demo_scenarios_list():
    res = client.get("/api/demo/scenarios")
    assert res.status_code == 200
    scenarios = res.json()
    assert len(scenarios) >= 4
    ids = [s["id"] for s in scenarios]
    assert "scenario_a" in ids
    assert "scenario_b" in ids
    assert "scenario_c" in ids
    assert "scenario_d" in ids


def test_run_demo_analysis_breaking():
    res = client.post("/api/demo/analyze", json={"scenario_id": "scenario_b"})
    assert res.status_code == 200
    data = res.json()
    assert data["metrics"]["high_severity_count"] == 1
    assert data["metrics"]["breaking_contract_changes"] == 1
    assert len(data["findings"]) >= 1
    f = data["findings"][0]
    assert f["severity"] == "high"
    assert f["field_name"] == "user_id"


def test_repositories_list():
    res = client.get("/api/repositories")
    assert res.status_code == 200
    repos = res.json()
    assert isinstance(repos, list)
    # git_repo should be listed
    names = [r["name"] for r in repos]
    assert "git_repo" in names
