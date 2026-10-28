"""
Tests for Pull Request analysis orchestration, repository authorization,
and finding review workflow.
"""

from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_pr_analysis_workflow_and_boundaries():
    # 1. Login as demo user
    login_res = client.post("/api/auth/demo-login")
    assert login_res.status_code == 200
    token = login_res.json()["token"]
    cookies = {"regrava_session": token}

    # 2. List authorized repos
    repos_res = client.get("/api/repos", cookies=cookies)
    assert repos_res.status_code == 200
    repos = repos_res.json()
    assert len(repos) >= 2
    repo_name = repos[0]["full_name"]

    # 3. List PRs for authorized repo
    prs_res = client.get(f"/api/repos/{repo_name}/pulls", cookies=cookies)
    assert prs_res.status_code == 200
    prs = prs_res.json()
    assert len(prs) >= 1
    pr_number = prs[0]["number"]

    # 4. Execute PR Analysis
    analyze_res = client.post(f"/api/repos/{repo_name}/pulls/{pr_number}/analyze", cookies=cookies)
    assert analyze_res.status_code == 200
    result = analyze_res.json()
    assert result["status"] == "completed"
    assert result["metrics"]["total_findings"] > 0
    assert result["metrics"]["security_findings_count"] > 0

    analysis_id = result["id"]
    finding_id = result["findings"][0]["id"]

    # 5. Fetch PR Analysis by ID
    get_res = client.get(f"/api/analysis/pr/{analysis_id}", cookies=cookies)
    assert get_res.status_code == 200
    assert get_res.json()["id"] == analysis_id

    # 6. Update finding review status to 'reviewed'
    patch_res = client.patch(
        f"/api/analysis/pr/{analysis_id}/findings/{finding_id}",
        json={"status": "reviewed", "notes": "Verified input is sanitized in middleware."},
        cookies=cookies,
    )
    assert patch_res.status_code == 200

    # 7. Confirm updated review status is persisted
    updated_res = client.get(f"/api/analysis/pr/{analysis_id}", cookies=cookies)
    target_finding = [f for f in updated_res.json()["findings"] if f["id"] == finding_id][0]
    assert target_finding["review_status"] == "reviewed"
    assert target_finding["review_notes"] == "Verified input is sanitized in middleware."

    # 8. Test authorization boundary: unauthorized repository returns 403
    unauthorized_res = client.get("/api/repos/secret-org/classified-repo/pulls", cookies=cookies)
    assert unauthorized_res.status_code == 403
