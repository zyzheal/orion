"""
Ticket Classification API

POST /api/v1/ai/classify - Classify incoming tickets using AI
"""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from typing import Optional

router = APIRouter()


class ClassifyRequest(BaseModel):
    """Request body for ticket classification."""
    ticket_id: str = Field(..., description="Unique ticket identifier")
    title: str = Field(..., description="Ticket title")
    description: str = Field(..., description="Full ticket description")
    category_hints: Optional[list[str]] = Field(None, description="Optional category hints from user")
    language: Optional[str] = Field("zh", description="Content language (zh/en)")


class ClassificationResult(BaseModel):
    """Single classification result."""
    category: str = Field(..., description="Predicted category")
    subcategory: Optional[str] = Field(None, description="Predicted subcategory")
    confidence: float = Field(..., ge=0.0, le=1.0, description="Confidence score")
    reasoning: Optional[str] = Field(None, description="LLM explanation of classification")


class ClassifyResponse(BaseModel):
    """Response body for ticket classification."""
    ticket_id: str
    classifications: list[ClassificationResult]
    processing_time_ms: float


@router.post("/classify", response_model=ClassifyResponse)
async def classify_ticket(
    request: ClassifyRequest,
    # TODO: Inject AI service via Depends
):
    """
    Classify an incoming support ticket.

    Uses LLM + RAG from knowledge base to categorize tickets
    into predefined categories and subcategories.
    """
    # TODO: Call ai_service.classify_ticket(request)
    # TODO: Query knowledge base for similar historical tickets
    # TODO: Return classification with confidence scores
    raise HTTPException(status_code=501, detail="Not yet implemented")
