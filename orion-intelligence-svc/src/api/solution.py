"""
Solution Recommendation API

POST /api/v1/ai/suggest-solution - AI-powered solution recommendation
"""

import time

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from src.services.ai_service import AIService
from src.api.dependencies import get_ai_service

router = APIRouter()


class SolutionRequest(BaseModel):
    """Request body for solution recommendation."""
    ticket_id: str = Field(..., description="Ticket identifier")
    category: str = Field(..., description="Ticket category")
    description: str = Field(..., description="Problem description")
    classification: dict | None = Field(None, description="Classification result from /classify")
    environment_info: dict | None = Field(None, description="Affected environment details")


class SolutionStep(BaseModel):
    """Single step in a recommended solution."""
    step_number: int = Field(..., description="Step order")
    action: str = Field(..., description="Action description")
    command: str | None = Field(None, description="Shell command to execute")
    expected_outcome: str | None = Field(None, description="What to expect after this step")
    risk_level: str = Field("low", description="low | medium | high")


class RecommendedSolution(BaseModel):
    """A recommended solution."""
    solution_title: str
    confidence: float = Field(..., ge=0.0, le=1.0)
    steps: list[SolutionStep]
    source: str = Field(..., description="Knowledge base article ID or 'generated'")
    estimated_time_minutes: int | None = Field(None)


class SolutionResponse(BaseModel):
    """Response body for solution recommendation."""
    ticket_id: str
    solutions: list[RecommendedSolution]
    processing_time_ms: float


@router.post("/suggest-solution", response_model=SolutionResponse)
async def suggest_solution(
    request: SolutionRequest,
    ai_service: AIService = Depends(get_ai_service),
):
    """
    Recommend solutions for a classified ticket.

    Retrieves similar resolved tickets from knowledge base and
    generates step-by-step solutions using LLM.
    """
    start = time.monotonic()

    result = await ai_service.suggest_solution(request)

    solutions = []
    for sol in result.get("recommended_solutions", []):
        steps = [
            SolutionStep(
                step_number=i + 1,
                action=s.get("action", ""),
                command=s.get("command"),
                expected_outcome=s.get("expected_outcome"),
                risk_level=s.get("risk_level", "low"),
            )
            for i, s in enumerate(result.get("steps", []))
        ]
        solutions.append(RecommendedSolution(
            solution_title=sol.get("solution", ""),
            confidence=sol.get("confidence", 0.5),
            steps=steps or [SolutionStep(step_number=1, action=sol.get("solution", ""))],
            source="generated",
            estimated_time_minutes=sol.get("estimated_effort"),
        ))

    return SolutionResponse(
        ticket_id=request.ticket_id,
        solutions=solutions,
        processing_time_ms=round((time.monotonic() - start) * 1000, 2),
    )
