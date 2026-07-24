"""Pydantic schemas for request/response validation."""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class AgentCreate(BaseModel):
    """Schema for creating a new agent."""

    tenant_id: str
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    config: Optional[dict] = None


class AgentUpdate(BaseModel):
    """Schema for updating an existing agent."""

    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    config: Optional[dict] = None
    status: Optional[str] = Field(None, max_length=50)


class AgentResponse(BaseModel):
    """Schema for returning a single agent."""

    id: str
    tenant_id: str
    name: str
    description: Optional[str]
    config: dict
    status: str
    created_at: Optional[str]
    updated_at: Optional[str]


class AgentListResponse(BaseModel):
    """Schema for agent list with pagination."""

    items: list[AgentResponse]
    total: int
    page: int
    page_size: int


class AgentExecuteRequest(BaseModel):
    """Schema for executing an agent."""

    input: str = Field(..., min_length=1)
    config_override: Optional[dict] = None


class AgentExecutionResponse(BaseModel):
    """Schema for returning a single execution."""

    id: str
    agent_id: str
    input: Optional[str]
    output: Optional[str]
    status: str
    started_at: Optional[str]
    completed_at: Optional[str]


class AgentExecutionListResponse(BaseModel):
    """Schema for execution list with pagination."""

    items: list[AgentExecutionResponse]
    total: int
    page: int
    page_size: int
