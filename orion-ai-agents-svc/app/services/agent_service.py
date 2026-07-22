"""AI Agent business logic service."""

from datetime import datetime
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.agent import Agent, AgentExecution
from app.repositories import agent_repo
from app.schemas.agent import (
    AgentCreate,
    AgentExecuteRequest,
    AgentExecutionListResponse,
    AgentExecutionResponse,
    AgentListResponse,
    AgentResponse,
    AgentUpdate,
)


class AgentService:
    """Service layer for AI Agent operations."""

    async def create_agent(self, session: AsyncSession, data: AgentCreate) -> AgentResponse:
        """Create a new AI agent."""
        agent = Agent(
            tenant_id=UUID(data.tenant_id),
            name=data.name,
            description=data.description,
            config=data.config,
            status="active",
        )
        created = await agent_repo.create_agent(session, agent)
        return AgentResponse(**created.to_dict())

    async def list_agents(
        self,
        session: AsyncSession,
        tenant_id: UUID,
        page: int = 1,
        page_size: int = 20,
        status: str | None = None,
    ) -> AgentListResponse:
        """List agents with pagination."""
        items, total = await agent_repo.list_agents(
            session, tenant_id, page=page, page_size=page_size, status=status
        )
        return AgentListResponse(
            items=[AgentResponse(**a.to_dict()) for a in items],
            total=total,
            page=page,
            page_size=page_size,
        )

    async def get_agent(self, session: AsyncSession, agent_id: UUID, tenant_id: UUID) -> AgentResponse | None:
        """Get a single agent by ID."""
        agent = await agent_repo.get_agent_by_id(session, agent_id, tenant_id)
        if agent is None:
            return None
        return AgentResponse(**agent.to_dict())

    async def update_agent(
        self, session: AsyncSession, agent_id: UUID, tenant_id: UUID, data: AgentUpdate
    ) -> AgentResponse | None:
        """Update an existing agent."""
        agent = await agent_repo.get_agent_by_id(session, agent_id, tenant_id)
        if agent is None:
            return None
        update_data = data.model_dump(exclude_unset=True)
        updated = await agent_repo.update_agent(session, agent, update_data)
        return AgentResponse(**updated.to_dict())

    async def delete_agent(self, session: AsyncSession, agent_id: UUID, tenant_id: UUID) -> bool:
        """Delete an agent and its executions."""
        agent = await agent_repo.get_agent_by_id(session, agent_id, tenant_id)
        if agent is None:
            return False
        await agent_repo.delete_agent(session, agent)
        return True

    async def execute_agent(
        self, session: AsyncSession, agent_id: UUID, tenant_id: UUID, data: AgentExecuteRequest
    ) -> AgentExecutionResponse | None:
        """Execute an agent and return the execution record."""
        agent = await agent_repo.get_agent_by_id(session, agent_id, tenant_id)
        if agent is None:
            return None

        execution = AgentExecution(
            agent_id=agent_id,
            input=data.input,
            status="running",
            started_at=datetime.utcnow(),
        )
        created = await agent_repo.create_execution(session, execution)

        # TODO: Integrate with actual LLM/agent execution logic
        # For now, simulate a completed execution
        created.output = f"Simulated execution result for agent {agent.name}"
        created.status = "completed"
        created.completed_at = datetime.utcnow()

        return AgentExecutionResponse(**created.to_dict())

    async def list_executions(
        self,
        session: AsyncSession,
        agent_id: UUID,
        page: int = 1,
        page_size: int = 20,
        status: str | None = None,
    ) -> AgentExecutionListResponse:
        """List executions for an agent."""
        items, total = await agent_repo.list_executions(
            session, agent_id, page=page, page_size=page_size, status=status
        )
        return AgentExecutionListResponse(
            items=[AgentExecutionResponse(**e.to_dict()) for e in items],
            total=total,
            page=page,
            page_size=page_size,
        )
