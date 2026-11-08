"""
Data models for AI Prompt Steering and AI Review Auditing in REGRAVA (RepoSentinel).
Supports structured prompt generation for Cursor Composer, Claude Code CLI, GitHub Copilot,
Windsurf, and generic coding agents, plus AST validation of external AI bot reviews.
"""

from enum import Enum
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field


class TargetAITool(str, Enum):
    CURSOR = "cursor"
    CLAUDE_CODE = "claude_code"
    COPILOT = "copilot"
    WINDSURF = "windsurf"
    GENERIC = "generic"


class SteeredPromptRequest(BaseModel):
    target_tool: TargetAITool = TargetAITool.CURSOR
    include_test_assertion: bool = True
    include_negative_constraints: bool = True


class SteeredPromptResponse(BaseModel):
    finding_id: str
    target_tool: TargetAITool
    prompt_text: str
    target_files: List[str] = Field(default_factory=list)
    constraints: List[str] = Field(default_factory=list)
    suggested_command: Optional[str] = None
    synthesized_test_snippet: Optional[str] = None
    suggested_patch_diff: Optional[str] = None


class AIAuditVerdict(str, Enum):
    VERIFIED_SOUND = "verified_sound"
    HALLUCINATED_API = "hallucinated_api"
    CONTRACT_REGRESSION = "contract_regression"
    SECURITY_RISK = "security_risk"
    COSMETIC_NOISE = "cosmetic_noise"


class AIAuditItem(BaseModel):
    id: str
    source_bot: str  # e.g., "coderabbitai[bot]", "copilot-pull-request-reviewer", "qodo-pr-agent"
    comment_body: str
    target_file: str
    target_line: Optional[int] = None
    verdict: AIAuditVerdict
    explanation: str
    ast_evidence: List[str] = Field(default_factory=list)
    suggested_action: str


class AIAuditRequest(BaseModel):
    pr_number: Optional[int] = None
    raw_comment_text: Optional[str] = None
    comments: List[Dict[str, Any]] = Field(default_factory=list)
    diff_context: Optional[str] = None


class AIAuditReport(BaseModel):
    pr_number: Optional[int] = None
    total_audited: int = 0
    sound_count: int = 0
    hallucination_count: int = 0
    regression_count: int = 0
    security_risk_count: int = 0
    noise_count: int = 0
    items: List[AIAuditItem] = Field(default_factory=list)
