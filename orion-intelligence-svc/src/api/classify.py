"""
Ticket Classification API

POST /api/v1/ai/classify - Classify incoming tickets using AI
"""

import time

from fastapi import APIRouter
from pydantic import BaseModel, Field

router = APIRouter()


class ClassifyRequest(BaseModel):
    """Request body for ticket classification."""
    ticket_id: str = Field(..., description="Unique ticket identifier")
    title: str = Field(..., description="Ticket title")
    description: str = Field(..., description="Full ticket description")
    category_hints: list[str] | None = Field(None, description="Optional category hints from user")
    language: str | None = Field("zh", description="Content language (zh/en)")


class ClassificationResult(BaseModel):
    """Single classification result."""
    category: str = Field(..., description="Predicted category")
    subcategory: str | None = Field(None, description="Predicted subcategory")
    confidence: float = Field(..., ge=0.0, le=1.0, description="Confidence score")
    reasoning: str | None = Field(None, description="LLM explanation of classification")


class ClassifyResponse(BaseModel):
    """Response body for ticket classification."""
    ticket_id: str
    classifications: list[ClassificationResult]
    processing_time_ms: float


@router.post("/classify", response_model=ClassifyResponse)
async def classify_ticket(request: ClassifyRequest):
    """
    Classify an incoming support ticket.

    Uses LLM + RAG from knowledge base to categorize tickets
    into predefined categories and subcategories.
    """
    start = time.monotonic()
    # TODO: Call ai_service.classify_ticket(request)
    # TODO: Query knowledge base for similar historical tickets
    result = ClassifyResponse(
        ticket_id=request.ticket_id,
        classifications=[],
        processing_time_ms=round((time.monotonic() - start) * 1000, 2),
    )
    return result
