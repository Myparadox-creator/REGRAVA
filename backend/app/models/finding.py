"""
Finding models for RepoSentinel.
Defines risk categories, severities, confidence levels, and evidence structures.
"""

from enum import Enum
from typing import List, Optional
from pydantic import BaseModel, Field
from app.models.contract import SourceLocation


class FindingCategory(str, Enum):
    API_CONTRACT = "api_contract"
    REMOVED_FIELD = "removed_field"
    TYPE_MISMATCH = "type_mismatch"
    REMOVED_ROUTE = "removed_route"
    PARAM_CHANGE = "param_change"
    FRONTEND_CONSUMER_RISK = "frontend_consumer_risk"
    SECRETS = "secrets"
    INJECTION = "injection"
    AUTHENTICATION = "authorization"
    INPUT_VALIDATION = "input_validation"
    CONFIGURATION = "configuration"
    DEPENDENCY = "dependency"


class Severity(str, Enum):
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"
    INFO = "info"


class Confidence(str, Enum):
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"


class TestEvidenceStatus(str, Enum):
    __test__ = False
    FOUND = "found"
    NOT_FOUND_BY_ANALYZER = "not_found_by_analyzer"
    UNKNOWN = "unknown"


class TestEvidenceItem(BaseModel):
    __test__ = False
    file_path: str
    test_name: str
    line: int
    matched_target: str
    description: str


class ChangedFileRef(BaseModel):
    path: str
    line: int
    symbol: Optional[str] = None
    old_value: Optional[str] = None
    new_value: Optional[str] = None


class AffectedFileRef(BaseModel):
    path: str
    line: int
    symbol: str
    context_snippet: Optional[str] = None


class Finding(BaseModel):
    id: str
    category: FindingCategory
    title: str
    severity: Severity
    confidence: Confidence
    summary: str
    changed_file: Optional[ChangedFileRef] = None
    affected_file: Optional[AffectedFileRef] = None
    evidence: List[str] = Field(default_factory=list)
    test_evidence: TestEvidenceStatus = TestEvidenceStatus.UNKNOWN
    test_evidence_items: List[TestEvidenceItem] = Field(default_factory=list)
    recommendation: str
    conditions: List[str] = Field(default_factory=list)
    attack_scenario: Optional[str] = None
    limitations: List[str] = Field(default_factory=list)
    review_status: str = "open"
    review_notes: Optional[str] = None
    route_path: Optional[str] = None
    field_name: Optional[str] = None
    model_name: Optional[str] = None
    change_type: Optional[str] = None
