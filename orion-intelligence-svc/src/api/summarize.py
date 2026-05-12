"""
Ticket Summarization API

POST /api/v1/ai/summarize - AI-powered ticket summarization
"""

import time

from fastapi import APIRouter
from pydantic import BaseModel, Field

router = APIRouter()


class SummarizeRequest(BaseModel):
    """Request body for ticket summarization."""
    ticket_id: str = Field(..., description="Ticket identifier")
    content: str = Field(..., description="Full ticket content (title + description + comments)")
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
async def summarize_ticket(request: SummarizeRequest):
    """
    Generate a concise summary of a ticket's content.

    Supports different summary granularity and extracts
    key points and action items from the conversation.
    """
    start = time.monotonic()
    # TODO: Call ai_service.summarize_ticket(request)
    # TODO: Handle long content with chunking if needed
    # TODO: Extract action items and key decisions
    result = SummarizeResponse(
        ticket_id=request.ticket_id,
        summary="",
        key_points=[],
        action_items=[],
        processing_time_ms=round((time.monotonic() - start) * 1000, 2),
    )
    return result
