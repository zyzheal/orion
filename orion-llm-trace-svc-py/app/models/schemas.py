"""LLM Trace domain models."""

from datetime import datetime
from enum import Enum
from typing import Optional
from uuid import UUID, uuid4

from pydantic import BaseModel, Field


class TraceStatus(str, Enum):
    PENDING = "pending"
    COMPLETED = "completed"
    FAILED = "failed"


class LLMTrace(BaseModel):
    id: UUID = Field(default_factory=uuid4)
    tenant_id: str
    user_id: Optional[str] = None
    scenario_id: Optional[str] = None
    provider_id: Optional[str] = None
    model_id: str
    prompt_content: Optional[str] = None
    prompt_hash: Optional[str] = None
    output_content: Optional[str] = None
    output_hash: Optional[str] = None
    input_tokens: int = 0
    output_tokens: int = 0
    total_tokens: int = 0
    input_cost: float = 0.0
    output_cost: float = 0.0
    total_cost: float = 0.0
    currency: str = "CNY"
    status: TraceStatus = TraceStatus.PENDING
    request_started_at: datetime = Field(default_factory=datetime.utcnow)
    request_completed_at: Optional[datetime] = None
    duration_ms: Optional[int] = None
    parent_trace_id: Optional[UUID] = None
    error_message: Optional[str] = None
    request_context: Optional[dict] = None
    metadata: Optional[dict] = None


class TraceStartRequest(BaseModel):
    model_id: str
    prompt_content: str
    user_id: Optional[str] = None
    scenario_id: Optional[str] = None
    provider_id: Optional[str] = None
    parent_trace_id: Optional[UUID] = None
    request_context: Optional[dict] = None


class TraceCompleteRequest(BaseModel):
    output_content: str
    input_tokens: int
    output_tokens: int
    error_message: Optional[str] = None


class DailyStats(BaseModel):
    date: str
    total_requests: int = 0
    total_tokens: int = 0
    total_cost: float = 0.0
    model_breakdown: dict = Field(default_factory=dict)


class TraceListParams(BaseModel):
    page: int = 1
    page_size: int = 20
    model_id: Optional[str] = None
    status: Optional[TraceStatus] = None
