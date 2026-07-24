"""
Ticket Summarization API

POST /api/v1/ai/summarize - AI-powered ticket summarization
"""

import time

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from src.services.ai_service import AIService
from src.api.dependencies import get_ai_service

router = APIRouter()


class SummarizeRequest(BaseModel):
    """Request body for ticket summarization."""
    ticket_id: str = Field(..., description="Ticket identifier")
    content: str = Field(..., description="Full ticket content (title + description + comments)")
    title: str = Field("", description="Ticket title")
    summary_type: str = Field("brief", description="brief | detailed | executive")
    language: str | None = Field("zh", description="Summary language (zh/en)")
    max_length: int | None = Field(None, description="Maximum summary length in characters")


class SummarizeResponse(BaseModel):
    """Response body for ticket summarization."""
    ticket_id: str
    summary: str = Field(..., description="Generated summary")
    key_points: list[str] = Field(default_factory=list, description="Key extracted points")
    action_items: list[str] = Field(default_factory=list, description="Identified action items")
    priority: str | None = Field(None, description="Inferred priority from content")
    processing_time_ms: float


@router.post("/summarize", response_model=SummarizeResponse)
async def summarize_ticket(
    request: SummarizeRequest,
    ai_service: AIService = Depends(get_ai_service),
):
    """
    Generate a concise summary of a ticket's content.

    Supports different summary granularity and extracts
    key points and action items from the conversation.
    """
    start = time.monotonic()

    result = await ai_service.summarize_ticket(request)

    return SummarizeResponse(
        ticket_id=request.ticket_id,
        summary=result.get("summary", ""),
        key_points=result.get("key_points", []),
        action_items=result.get("action_items", []),
        processing_time_ms=round((time.monotonic() - start) * 1000, 2),
    )
