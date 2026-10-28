"""
Integration tests for RepoSentinel demo scenarios and security boundaries.
"""

import pytest
from pathlib import Path
from app.config import settings
from app.models.finding import Severity, TestEvidenceStatus
from app.services.analysis_service import SecurityError, analysis_service


def test_scenario_a_baseline():
    """Test A: Baseline contract and frontend consumer agree (0 high severity risks)."""
    demo_root = settings.EXAMPLES_DIR
    base_dir = demo_root / "base"

    result = analysis_service.analyze_directories(
        base_dir=base_dir,
        head_dir=base_dir,
        target_name="Scenario A: Baseline",
    )
    assert result.metrics.high_severity_count == 0
    assert result.metrics.breaking_contract_changes == 0
    # No user_id compatibility mismatch
    mismatch_findings = [f for f in result.findings if f.field_name == "user_id" and f.severity == Severity.HIGH]
    assert len(mismatch_findings) == 0


def test_scenario_b_breaking_change():
    """Test B: Backend removes user_id, frontend references it (high-severity regression)."""
    demo_root = settings.EXAMPLES_DIR
    base_dir = demo_root / "base"
    head_dir = demo_root / "breaking"

    result = analysis_service.analyze_directories(
        base_dir=base_dir,
        head_dir=head_dir,
        target_name="Scenario B: Breaking Change",
    )
    assert result.metrics.high_severity_count == 1
    assert result.metrics.breaking_contract_changes == 1
    assert result.metrics.affected_consumers_identified >= 1

    finding = result.findings[0]
    assert finding.severity == Severity.HIGH
    assert finding.field_name == "user_id"
    assert "user_id" in finding.title
    assert finding.affected_file is not None
    assert "UserProfile.tsx" in finding.affected_file.path
    assert finding.affected_file.line == 22
    assert "userId = user.user_id" in finding.affected_file.context_snippet


def test_scenario_c_fixed_change():
    """Test C: Frontend updated to match new contract (mismatch finding disappears)."""
    demo_root = settings.EXAMPLES_DIR
    base_dir = demo_root / "base"
    head_dir = demo_root / "fixed"

    result = analysis_service.analyze_directories(
        base_dir=base_dir,
        head_dir=head_dir,
        target_name="Scenario C: Fixed Consumer",
    )
    # The high-severity consumer mismatch must be gone
    assert result.metrics.high_severity_count == 0
    assert result.metrics.affected_consumers_identified == 0


def test_scenario_d_harmless_change():
    """Test D: Harmless documentation/formatting does not produce regression warnings."""
    demo_root = settings.EXAMPLES_DIR
    base_dir = demo_root / "base"
    head_dir = demo_root / "harmless"

    result = analysis_service.analyze_directories(
        base_dir=base_dir,
        head_dir=head_dir,
        target_name="Scenario D: Harmless Change",
    )
    assert result.metrics.high_severity_count == 0
    assert result.metrics.medium_severity_count == 0
    assert result.metrics.breaking_contract_changes == 0


def test_path_traversal_security_restriction(tmp_path):
    """Test that unauthorized paths outside configured workspaces/examples raise SecurityError."""
    outside_dir = tmp_path / "outside_workspace"
    outside_dir.mkdir()

    with pytest.raises(SecurityError):
        analysis_service.validate_workspace_path(outside_dir)
