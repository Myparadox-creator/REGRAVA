"""
Demo endpoints for evaluating RepoSentinel on curated scenarios.
"""

from typing import List
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from app.config import settings
from app.models.analysis import AnalysisResult, DemoScenario
from app.services.analysis_service import analysis_service

router = APIRouter(prefix="/demo", tags=["Demonstration"])

SCENARIOS: List[DemoScenario] = [
    DemoScenario(
        id="scenario_a",
        name="Scenario A: Baseline (Consistent Contract)",
        description="FastAPI endpoint returns UserResponse(user_id=101, name='Aditya'). React component accesses user.user_id.",
        expected_outcome="0 high-severity risks. Full contract compatibility.",
        base_description="Base revision defines user_id: int",
        head_description="Head revision defines user_id: int",
    ),
    DemoScenario(
        id="scenario_b",
        name="Scenario B: Breaking Change (Removed Field)",
        description="Backend replaces user_id with id in response model. Frontend still accesses user.user_id.",
        expected_outcome="High-severity regression detected pointing directly to UserProfile.tsx line 22.",
        base_description="Base revision defines user_id: int",
        head_description="Head revision removes user_id and introduces id: int",
    ),
    DemoScenario(
        id="scenario_c",
        name="Scenario C: Fixed Consumer (Contract Migrated)",
        description="Frontend component updated to access user.id matching the new backend response model.",
        expected_outcome="Original high-severity frontend consumer mismatch is completely resolved.",
        base_description="Base revision defines user_id: int",
        head_description="Head revision defines id: int; frontend consumes user.id",
    ),
    DemoScenario(
        id="scenario_d",
        name="Scenario D: Harmless Change (Documentation & Formatting)",
        description="Backend docstrings and comments updated without modifying API contracts or field types.",
        expected_outcome="0 regressions. Proves analyzer does not flag harmless changes.",
        base_description="Original endpoints and models",
        head_description="Docstrings and comment formatting updated",
    ),
]


class DemoAnalyzeRequest(BaseModel):
    scenario_id: str


@router.get("/scenarios", response_model=List[DemoScenario])
def get_demo_scenarios():
    """List available reproducible demonstration scenarios."""
    return SCENARIOS


@router.post("/analyze", response_model=AnalysisResult)
def run_demo_analysis(request: DemoAnalyzeRequest):
    """Execute real static analysis on the selected demonstration scenario."""
    demo_root = settings.EXAMPLES_DIR
    base_dir = demo_root / "base"

    scenario_map = {
        "scenario_a": ("base", "Scenario A: Baseline"),
        "scenario_b": ("breaking", "Scenario B: Breaking Change"),
        "scenario_c": ("fixed", "Scenario C: Fixed Consumer"),
        "scenario_d": ("harmless", "Scenario D: Harmless Change"),
    }

    if request.scenario_id not in scenario_map:
        raise HTTPException(
            status_code=400,
            detail=f"Unknown scenario ID '{request.scenario_id}'. Available: {list(scenario_map.keys())}",
        )

    folder_name, title = scenario_map[request.scenario_id]
    head_dir = demo_root / folder_name

    try:
        result = analysis_service.analyze_directories(
            base_dir=base_dir,
            head_dir=head_dir,
            target_name=title,
            base_label="base",
            head_label=folder_name,
        )
        return result
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to analyze demo scenario: {str(e)}",
        )
