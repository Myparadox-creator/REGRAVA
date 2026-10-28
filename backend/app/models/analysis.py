"""
Analysis request and result models for RepoSentinel.
"""

from enum import Enum
from typing import Dict, List, Optional, Any
from pydantic import BaseModel, Field
from app.models.finding import Finding, Severity


class AnalysisStatus(str, Enum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    PARTIAL = "partial"


class AnalysisMetrics(BaseModel):
    total_findings: int = 0
    high_severity_count: int = 0
    medium_severity_count: int = 0
    low_severity_count: int = 0
    info_severity_count: int = 0
    breaking_contract_changes: int = 0
    affected_consumers_identified: int = 0
    test_evidence_gaps: int = 0
    files_analyzed: int = 0
    warnings_count: int = 0


class ContractDiffSummary(BaseModel):
    routes_added: List[str] = Field(default_factory=list)
    routes_removed: List[str] = Field(default_factory=list)
    models_modified: List[str] = Field(default_factory=list)
    fields_removed: List[str] = Field(default_factory=list)
    fields_added: List[str] = Field(default_factory=list)
    fields_type_changed: List[str] = Field(default_factory=list)


class AnalysisRequest(BaseModel):
    repo_path: Optional[str] = None
    base_ref: str = "main"
    head_ref: str = "HEAD"
    scenario_id: Optional[str] = None


class AnalysisResult(BaseModel):
    analysis_id: str
    target_name: str
    base_ref: str
    head_ref: str
    status: AnalysisStatus
    created_at: str
    metrics: AnalysisMetrics = Field(default_factory=AnalysisMetrics)
    findings: List[Finding] = Field(default_factory=list)
    contract_diff: ContractDiffSummary = Field(default_factory=ContractDiffSummary)
    warnings: List[str] = Field(default_factory=list)
    test_summary: Dict[str, Any] = Field(default_factory=dict)
    execution_time_ms: float = 0.0


class DemoScenario(BaseModel):
    id: str
    name: str
    description: str
    expected_outcome: str
    base_description: str
    head_description: str
