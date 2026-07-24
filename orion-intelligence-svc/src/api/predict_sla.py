"""
SLA Prediction API

POST /api/v1/ai/predict-sla - AI-powered SLA breach prediction
"""

import time
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from src.services.ai_service import AIService
from src.api.dependencies import get_ai_service

router = APIRouter()


class SLAPredictionRequest(BaseModel):
    """Request body for SLA prediction."""
    ticket_id: str = Field(..., description="Ticket identifier")
    category: str = Field(..., description="Ticket category")
    priority: str = Field(..., description="P1 | P2 | P3 | P4")
    created_at: datetime = Field(..., description="Ticket creation time")
    sla_target_hours: float | None = Field(None, description="SLA target in hours")
    current_assignee: str | None = Field(None, description="Current assignee ID")
    response_time_minutes: int | None = Field(None, description="Time to first response")
    sentiment_score: float | None = Field(None, description="Current sentiment score")


class SLAPrediction(BaseModel):
    """SLA prediction result."""
    breach_probability: float = Field(..., ge=0.0, le=1.0, description="Probability of SLA breach")
    risk_level: str = Field(..., description="low | medium | high | critical")
    predicted_resolution_time: datetime | None = Field(None, description="Predicted resolution time")
    time_remaining_minutes: int | None = Field(None, description="Estimated minutes remaining until SLA deadline")
    contributing_factors: list[str] = Field(default_factory=list, description="Factors increasing breach risk")
    recommended_actions: list[str] = Field(default_factory=list, description="Actions to reduce breach risk")


class SLAPredictionResponse(BaseModel):
    """Response body for SLA prediction."""
    ticket_id: str
    prediction: SLAPrediction
    sla_policy: str | None = Field(None, description="Applied SLA policy name")
    processing_time_ms: float


@router.post("/predict-sla", response_model=SLAPredictionResponse)
async def predict_sla_breach(
    request: SLAPredictionRequest,
    ai_service: AIService = Depends(get_ai_service),
):
    """
    Predict the probability of an SLA breach for a ticket.

    Analyzes ticket characteristics, historical resolution patterns
    from ClickHouse, and current sentiment to predict SLA risk.
    """
    start = time.monotonic()

    sla_config = {
        "response_minutes": 30 if request.priority == "P1" else 60,
        "resolution_minutes": 240 if request.priority == "P1" else 480,
    }

    ticket = {
        "category": request.category,
        "priority": request.priority,
        "sentiment_score": request.sentiment_score,
    }

    class PredictRequest:
        pass

    predict_req = PredictRequest()
    predict_req.ticket = ticket
    predict_req.sla_config = sla_config
    predict_req.elapsed_minutes = int((datetime.now() - request.created_at).total_seconds() / 60)

    result = await ai_service.predict_sla(predict_req)

    prob = result.get("breach_probability", 0) / 100
    if prob >= 0.8:
        risk = "critical"
    elif prob >= 0.6:
        risk = "high"
    elif prob >= 0.3:
        risk = "medium"
    else:
        risk = "low"

    time_remaining = result.get("time_remaining_minutes")
    predicted_time = None
    if time_remaining is not None:
        predicted_time = datetime.now() + timedelta(minutes=time_remaining)

    return SLAPredictionResponse(
        ticket_id=request.ticket_id,
        prediction=SLAPrediction(
            breach_probability=min(max(result.get("breach_probability", 0) / 100, 0.0), 1.0),
            risk_level=risk,
            predicted_resolution_time=predicted_time,
            time_remaining_minutes=time_remaining,
            contributing_factors=result.get("risk_factors", []),
            recommended_actions=result.get("recommended_actions", []),
        ),
        processing_time_ms=round((time.monotonic() - start) * 1000, 2),
    )
