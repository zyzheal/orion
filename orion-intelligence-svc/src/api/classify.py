"""
Ticket Classification API

POST /api/v1/ai/classify - Classify incoming tickets using AI
"""

import time
from typing import Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from src.services.ai_service import AIService
from src.api.dependencies import get_ai_service

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
async def classify_ticket(
    request: ClassifyRequest,
    ai_service: AIService = Depends(get_ai_service),
):
    """
    Classify an incoming support ticket.

    Uses LLM + RAG from knowledge base to categorize tickets
    into predefined categories and subcategories.
    """
    start = time.monotonic()

    result = await ai_service.classify_ticket(request)

    classifications = [
        ClassificationResult(
            category=result.get("category", "application"),
            subcategory=result.get("subcategory"),
            confidence=result.get("confidence", 0.5),
            reasoning=result.get("reasoning"),
        )
    ]

    return ClassifyResponse(
        ticket_id=request.ticket_id,
        classifications=classifications,
        processing_time_ms=round((time.monotonic() - start) * 1000, 2),
    )
