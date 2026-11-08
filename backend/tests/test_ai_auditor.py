"""
Unit tests for REGRAVA AI Review Auditor.
"""

from app.analyzer.ai_auditor import AIAuditor
from app.models.prompt_steering import AIAuditRequest, AIAuditVerdict


def test_audit_hallucinated_lodash_method():
    req = AIAuditRequest(
        comments=[
            {
                "id": "c1",
                "source_bot": "coderabbitai[bot]",
                "body": "Consider using `lodash.deepMerge(state, update)` to avoid mutating original state.",
                "path": "frontend/src/store/user.ts",
                "line": 42,
            }
        ]
    )

    report = AIAuditor.audit_report(req)
    assert report.total_audited == 1
    assert report.hallucination_count == 1
    item = report.items[0]
    assert item.verdict == AIAuditVerdict.HALLUCINATED_API
    assert "deepMerge" in item.explanation
    assert "DISMISS" in item.suggested_action


def test_audit_security_risk_drop_tenancy():
    req = AIAuditRequest(
        comments=[
            {
                "id": "c2",
                "source_bot": "copilot-pull-request-reviewer[bot]",
                "body": "You can remove the tenant_id filter clause here since the user is already authenticated in session.",
                "path": "backend/app/db/invoices.py",
                "line": 88,
            }
        ]
    )

    report = AIAuditor.audit_report(req)
    assert report.total_audited == 1
    assert report.security_risk_count == 1
    item = report.items[0]
    assert item.verdict == AIAuditVerdict.SECURITY_RISK
    assert "BLOCK / REJECT" in item.suggested_action


def test_audit_cosmetic_noise():
    req = AIAuditRequest(
        comments=[
            {
                "id": "c3",
                "source_bot": "coderabbitai[bot]",
                "body": "Minor nit: consider adding a docstring to explain what this utility returns.",
                "path": "backend/app/utils/format.py",
                "line": 10,
            }
        ]
    )

    report = AIAuditor.audit_report(req)
    assert report.total_audited == 1
    assert report.noise_count == 1
    item = report.items[0]
    assert item.verdict == AIAuditVerdict.COSMETIC_NOISE
    assert "MUTE / IGNORE" in item.suggested_action


def test_audit_contract_regression():
    req = AIAuditRequest(
        comments=[
            {
                "id": "c4",
                "source_bot": "qodo-pr-agent[bot]",
                "body": "Rename field user_id to account_id in Pydantic schema for consistency with Stripe naming conventions.",
                "path": "backend/app/schemas/billing.py",
                "line": 15,
            }
        ]
    )

    report = AIAuditor.audit_report(req)
    assert report.total_audited == 1
    assert report.regression_count == 1
    item = report.items[0]
    assert item.verdict == AIAuditVerdict.CONTRACT_REGRESSION
    assert "STEER" in item.suggested_action


def test_audit_raw_markdown_text_parsing():
    raw_text = """### CodeRabbit Bot Review
L12 in backend/app/main.py: Minor nit: clean up variable name for clarity.

### Copilot Review
L55 in backend/app/db.py: Parameter user_id should be sanitized with parameterized query to prevent SQL injection.
"""
    req = AIAuditRequest(raw_comment_text=raw_text)
    report = AIAuditor.audit_report(req)
    assert report.total_audited == 2
    assert report.noise_count == 1
    assert report.sound_count == 1
