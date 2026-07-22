"""API routes for AI Agent management."""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_session
from app.schemas.agent import (
    AgentCreate,
    AgentExecuteRequest,
    AgentExecutionListResponse,
    AgentExecutionResponse,
    AgentListResponse,
    AgentResponse,
    AgentUpdate,
)
from app.services.agent_service import AgentService

router = APIRouter(prefix="/api/v1", tags=["ai-agents"])
agent_service = AgentService()


# --- Agent CRUD ---

@router.post("/agents", response_model=AgentResponse, status_code=201)
async def create_agent(
    data: AgentCreate,
    session: AsyncSession = Depends(get_session),
):
    """Create a new AI agent."""
    return await agent_service.create_agent(session, data)


@router.get("/agents", response_model=AgentListResponse)
async def list_agents(
    tenant_id: UUID = Query(..., description="Tenant identifier"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    status: str | None = Query(None),
    session: AsyncSession = Depends(get_session),
):
    """List agents with pagination and filters."""
    return await agent_service.list_agents(
        session, tenant_id, page=page, page_size=page_size, status=status
    )


@router.get("/agents/{agent_id}", response_model=AgentResponse)
async def get_agent(
    agent_id: UUID,
    tenant_id: UUID = Query(..., description="Tenant identifier"),
    session: AsyncSession = Depends(get_session),
):
    """Get agent detail by ID."""
    agent = await agent_service.get_agent(session, agent_id, tenant_id)
    if agent is None:
        raise HTTPException(status_code=404, detail="Agent not found")
    return agent


@router.put("/agents/{agent_id}", response_model=AgentResponse)
async def update_agent(
    agent_id: UUID,
    data: AgentUpdate,
    tenant_id: UUID = Query(..., description="Tenant identifier"),
    session: AsyncSession = Depends(get_session),
):
    """Update an existing agent."""
    agent = await agent_service.update_agent(session, agent_id, tenant_id, data)
    if agent is None:
        raise HTTPException(status_code=404, detail="Agent not found")
    return agent


@router.delete("/agents/{agent_id}", status_code=204)
async def delete_agent(
    agent_id: UUID,
    tenant_id: UUID = Query(..., description="Tenant identifier"),
    session: AsyncSession = Depends(get_session),
):
    """Delete an agent and its executions."""
    deleted = await agent_service.delete_agent(session, agent_id, tenant_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Agent not found")


# --- Agent Execution ---

@router.post("/agents/{agent_id}/execute", response_model=AgentExecutionResponse, status_code=201)
async def execute_agent(
    agent_id: UUID,
    data: AgentExecuteRequest,
    tenant_id: UUID = Query(..., description="Tenant identifier"),
    session: AsyncSession = Depends(get_session),
):
    """Execute an agent with given input."""
    execution = await agent_service.execute_agent(session, agent_id, tenant_id, data)
    if execution is None:
        raise HTTPException(status_code=404, detail="Agent not found")
    return execution


@router.get("/agents/{agent_id}/executions", response_model=AgentExecutionListResponse)
async def list_executions(
    agent_id: UUID,
    tenant_id: UUID = Query(..., description="Tenant identifier"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    status: str | None = Query(None),
    session: AsyncSession = Depends(get_session),
):
    """List execution history for an agent."""
    return await agent_service.list_executions(
        session, agent_id, page=page, page_size=page_size, status=status
    )
