"""
Root Cause Analysis API

POST /api/v1/ai/root-cause - AI-powered root cause analysis
"""

import time

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from src.services.ai_service import AIService
from src.api.dependencies import get_ai_service

router = APIRouter()


class RootCauseRequest(BaseModel):
    """Request body for root cause analysis."""
    incident_id: str = Field(..., description="Incident/ticket identifier")
    description: str = Field(..., description="Incident description")
    error_logs: str | None = Field(None, description="Relevant error logs")
    metrics_data: dict | None = Field(None, description="Time-series metrics around incident")
    affected_services: list[str] | None = Field(None, description="List of affected services")
    timeline: list[dict] | None = Field(None, description="Event timeline: [{timestamp, event}]")


class RootCauseCandidate(BaseModel):
    """A potential root cause."""
    cause: str = Field(..., description="Description of potential root cause")
    confidence: float = Field(..., ge=0.0, le=1.0, description="Confidence score")
    evidence: list[str] = Field(default_factory=list, description="Supporting evidence")
    category: str = Field(..., description="infrastructure | code | config | dependency | external")


class RootCauseResponse(BaseModel):
    """Response body for root cause analysis."""
    incident_id: str
    root_causes: list[RootCauseCandidate]
    recommended_actions: list[str]
    similar_incidents: list[str] | None = Field(None, description="IDs of similar past incidents")
    processing_time_ms: float


@router.post("/root-cause", response_model=RootCauseResponse)
async def analyze_root_cause(
    request: RootCauseRequest,
    ai_service: AIService = Depends(get_ai_service),
):
    """
    Analyze an incident to identify potential root causes.

    Uses LLM reasoning combined with historical incident data
    from ClickHouse to suggest likely root causes.
    """
    start = time.monotonic()

    result = await ai_service.analyze_root_cause(request)

    root_causes = [
        RootCauseCandidate(
            cause=result.get("root_cause", ""),
            confidence=result.get("confidence", 0.5),
            evidence=result.get("contributing_factors", []),
            category=result.get("root_cause_type", "code"),
        )
    ]

    return RootCauseResponse(
        incident_id=request.incident_id,
        root_causes=root_causes,
        recommended_actions=result.get("recommended_actions", []),
        processing_time_ms=round((time.monotonic() - start) * 1000, 2),
    )
