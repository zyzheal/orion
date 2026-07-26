"""Pydantic schemas for request/response validation."""

from datetime import datetime
from decimal import Decimal
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field


class TraceCreate(BaseModel):
    """Schema for creating a new trace."""

    tenant_id: UUID
    trace_id: Optional[str] = Field(None, max_length=64)
    model: Optional[str] = Field(None, max_length=100)
    prompt: Optional[str] = None
    response: Optional[str] = None
    tokens_used: Optional[int] = None
    cost: Optional[Decimal] = Field(None, max_digits=10, decimal_places=4)
    status: Optional[str] = Field(None, max_length=50)


class TraceResponse(BaseModel):
    """Schema for returning a single trace."""

    id: str
    tenant_id: str
    trace_id: Optional[str]
    model: Optional[str]
    prompt: Optional[str]
    response: Optional[str]
    tokens_used: Optional[int]
    cost: Optional[float]
    status: Optional[str]
    created_at: Optional[str]


class TraceListResponse(BaseModel):
    """Schema for trace list with pagination."""

    items: list[TraceResponse]
    total: int
    page: int
    page_size: int


class ModelInfo(BaseModel):
    """Schema for model statistics."""

    model: str
    call_count: int
    avg_tokens: Optional[float]
    total_cost: float


class ModelListResponse(BaseModel):
    """Schema for model list."""

    items: list[ModelInfo]
    total_models: int


class CostSummary(BaseModel):
    """Schema for cost summary."""

    total_cost: float
    total_tokens: int
    total_traces: int
    avg_cost_per_trace: float
    model_breakdown: list[ModelInfo]
