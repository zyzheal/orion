"""
Data Models

Shared Pydantic models used across the AI service.
"""

from datetime import datetime
from enum import Enum
from typing import Optional
from pydantic import BaseModel, Field


class Priority(str, Enum):
    P1 = "P1"
    P2 = "P2"
    P3 = "P3"
    P4 = "P4"


class Severity(str, Enum):
    CRITICAL = "critical"
    WARNING = "warning"
    SUGGESTION = "suggestion"
    NIT = "nit"


class RiskLevel(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class Sentiment(str, Enum):
    POSITIVE = "positive"
    NEUTRAL = "neutral"
    NEGATIVE = "negative"


class TicketCategory(str, Enum):
    """TODO: Replace with actual category taxonomy from orion-ticket-svc."""
    INFRASTRUCTURE = "infrastructure"
    APPLICATION = "application"
    DATABASE = "database"
    NETWORK = "network"
    SECURITY = "security"
    BILLING = "billing"
    ACCOUNT = "account"
    OTHER = "other"


class KnowledgeHit(BaseModel):
    """Result from knowledge base RAG query."""
    doc_id: str
    title: str
    snippet: str
    relevance_score: float = Field(..., ge=0.0, le=1.0)
    source: str  # URL or document reference


class HistoricalIncident(BaseModel):
    """Historical incident record from ClickHouse."""
    incident_id: str
    category: str
    description: str
    root_cause: Optional[str]
    resolution: Optional[str]
    resolution_time_minutes: Optional[int]
    severity: str
    created_at: datetime


class UsageMetrics(BaseModel):
    """LLM token usage tracking."""
    prompt_tokens: int = 0
    completion_tokens: int = 0
    total_tokens: int = 0
    cost_usd: Optional[float] = None
