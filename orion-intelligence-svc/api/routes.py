"""
Base API Routes for Orion Intelligence Service

Provides core decision-making and status endpoints.
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter()


class DecisionRequest(BaseModel):
    """Request body for decision endpoint."""
    context: dict
    options: list


class DecisionResponse(BaseModel):
    """Response body for decision endpoint."""
    decision: str
    confidence: float
    reasoning: str


@router.post("/decision", response_model=DecisionResponse)
async def make_decision(req: DecisionRequest):
    """
    Make a decision based on context and options.

    Simple rule-based decision engine for intelligent routing.
    """
    if not req.options:
        raise HTTPException(status_code=400, detail="No options provided")

    # Simple rule engine implementation - returns first option with default confidence
    return DecisionResponse(
        decision=req.options[0],
        confidence=0.8,
        reasoning="Default rule-based decision engine"
    )


@router.get("/status")
async def status():
    """
    Get service status and engine information.
    """
    return {
        "status": "running",
        "engine": "rule-based",
        "service": "orion-intelligence-svc"
    }