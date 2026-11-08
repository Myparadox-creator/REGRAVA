"""
Unit tests for REGRAVA Prompt Generator and AI Steering.
"""

import pytest
from app.analyzer.prompt_generator import PromptGenerator
from app.models.finding import (
    Finding,
    FindingCategory,
    Severity,
    Confidence,
    ChangedFileRef,
    AffectedFileRef,
)
from app.models.prompt_steering import TargetAITool


@pytest.fixture
def sample_contract_drift_finding():
    return Finding(
        id="REG-001",
        category=FindingCategory.REMOVED_FIELD,
        title="Removed field 'user_id' in Pydantic UserResponse model",
        severity=Severity.HIGH,
        confidence=Confidence.HIGH,
        summary="Backend removed field 'user_id' from UserResponse, but frontend consumer UserCard.tsx still reads it.",
        changed_file=ChangedFileRef(
            path="backend/app/schemas/user.py",
            line=18,
            symbol="UserResponse",
            old_value="user_id",
            new_value="id",
        ),
        affected_file=AffectedFileRef(
            path="frontend/src/components/UserCard.tsx",
            line=24,
            symbol="UserCard",
            context_snippet="const uid = user.user_id;",
        ),
        evidence=["Pydantic model diff: - user_id, + id"],
        recommendation="Update UserCard.tsx to reference user.id instead of user.user_id.",
        field_name="user_id",
        route_path="/api/v1/users/me",
    )


def test_cursor_prompt_generation(sample_contract_drift_finding):
    resp = PromptGenerator.generate(
        finding=sample_contract_drift_finding,
        target_tool=TargetAITool.CURSOR,
        include_test_assertion=True,
        include_negative_constraints=True,
    )

    assert resp.finding_id == "REG-001"
    assert resp.target_tool == TargetAITool.CURSOR
    assert "@backend/app/schemas/user.py" in resp.prompt_text
    assert "@frontend/src/components/UserCard.tsx" in resp.prompt_text
    assert "Do NOT revert intentional backend changes" in resp.prompt_text
    assert "Vitest Contract Proof" in resp.prompt_text
    assert resp.synthesized_test_snippet is not None
    assert "toHaveProperty('user_id')" in resp.synthesized_test_snippet
    assert resp.suggested_patch_diff is not None


def test_claude_code_prompt_generation(sample_contract_drift_finding):
    resp = PromptGenerator.generate(
        finding=sample_contract_drift_finding,
        target_tool=TargetAITool.CLAUDE_CODE,
        include_test_assertion=True,
    )

    assert resp.target_tool == TargetAITool.CLAUDE_CODE
    assert "Fix the HIGH regression detected by REGRAVA" in resp.prompt_text
    assert "npm run build && npm test" in resp.prompt_text
    assert resp.suggested_command == "npm run build && npm test"


def test_injection_prompt_generation():
    sqli_finding = Finding(
        id="SEC-002",
        category=FindingCategory.INJECTION,
        title="Unsanitized raw SQL concatenation",
        severity=Severity.HIGH,
        confidence=Confidence.HIGH,
        summary="User query parameter injected directly into raw SQL string format.",
        changed_file=ChangedFileRef(
            path="backend/app/db/orders.py",
            line=45,
            symbol="get_orders",
        ),
        recommendation="Use parameterized query execution with cursor.execute(query, (param,)).",
    )

    resp = PromptGenerator.generate(
        finding=sqli_finding,
        target_tool=TargetAITool.CURSOR,
    )

    assert "Never use string formatting, f-strings, or raw concatenation" in resp.prompt_text
    assert "Pytest Injection Safety Proof" in resp.synthesized_test_snippet
