"""
Sentiment Analysis API

POST /api/v1/ai/sentiment - AI-powered sentiment analysis
"""

import time

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from src.services.ai_service import AIService
from src.api.dependencies import get_ai_service

router = APIRouter()


class SentimentRequest(BaseModel):
    """Request body for sentiment analysis."""
    ticket_id: str = Field(..., description="Ticket identifier")
    content: str = Field(..., description="Content to analyze (comment or full thread)")
    historical: list[dict] | None = Field(None, description="Historical sentiment data: [{timestamp, content}]")
    analyze_urgency: bool = Field(True, description="Whether to detect urgency signals")


class SentimentResult(BaseModel):
    """Sentiment analysis result."""
    overall_sentiment: str = Field(..., description="positive | neutral | negative")
    sentiment_score: float = Field(..., ge=-1.0, le=1.0, description="-1 (very negative) to +1 (very positive)")
    emotions: dict | None = Field(None, description="Emotion breakdown")
    urgency_level: str | None = Field(None, description="low | medium | high | critical")
    key_phrases: list[str] = Field(default_factory=list, description="Sentiment-driving phrases")
    escalation_recommended: bool = Field(False, description="Whether to recommend escalation")


class SentimentResponse(BaseModel):
    """Response body for sentiment analysis."""
    ticket_id: str
    results: list[SentimentResult]
    trend: str | None = Field(None, description="Sentiment trend: improving | stable | deteriorating")
    processing_time_ms: float


@router.post("/sentiment", response_model=SentimentResponse)
async def analyze_sentiment(
    request: SentimentRequest,
    ai_service: AIService = Depends(get_ai_service),
):
    """
    Analyze sentiment of ticket content or customer communications.

    Detects customer satisfaction, urgency signals, and recommends
    escalation when negative sentiment is detected.
    """
    start = time.monotonic()

    result = await ai_service.analyze_sentiment(request)

    sentiment = result.get("overall_sentiment", "neutral")
    score_map = {"positive": 0.7, "neutral": 0.0, "negative": -0.7}
    score = score_map.get(sentiment, 0.0)

    urgency = result.get("urgency_level")
    escalation = urgency in ("high", "critical") or sentiment == "negative"

    results = [
        SentimentResult(
            overall_sentiment=sentiment,
            sentiment_score=score,
            emotions={e: True for e in result.get("emotions", [])},
            urgency_level=urgency,
            escalation_recommended=escalation,
        )
    ]

    return SentimentResponse(
        ticket_id=request.ticket_id,
        results=results,
        processing_time_ms=round((time.monotonic() - start) * 1000, 2),
    )
