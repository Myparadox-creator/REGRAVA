"""
Health check endpoint for RepoSentinel backend.
"""

from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter(tags=["Health"])


class HealthResponse(BaseModel):
    status: str
    service: str
    version: str


@router.get("/health", response_model=HealthResponse)
def get_health():
    return HealthResponse(
        status="ok",
        service="REGRAVA / RepoSentinel Static Analysis Engine",
        version="2.0.0",
    )
