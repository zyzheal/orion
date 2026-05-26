"""Database dependencies."""

from collections.abc import AsyncGenerator
from datetime import datetime
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.sql import Select

from app.config import Settings
from app.models.agent import Agent, AgentExecution

_engine = None
_session_factory = None


async def init_db(settings: Settings) -> None:
    """Initialize database engine and session factory."""
    global _engine, _session_factory
    _engine = create_async_engine(settings.database_url, echo=settings.debug)
    _session_factory = async_sessionmaker(_engine, class_=AsyncSession, expire_on_commit=False)


async def close_db() -> None:
    """Close database engine."""
    global _engine
    if _engine:
        await _engine.dispose()


async def get_session() -> AsyncGenerator[AsyncSession, None]:
    """Yield a database session for dependency injection."""
    async with _session_factory() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise


def _base_query(tenant_id: UUID) -> Select:
    """Return base query with tenant filter applied."""
    return select(Agent).where(Agent.tenant_id == tenant_id)


async def create_agent(session: AsyncSession, agent: Agent) -> Agent:
    """Create a new agent record."""
    session.add(agent)
    await session.flush()
    return agent


async def get_agent_by_id(session: AsyncSession, agent_id: UUID, tenant_id: UUID) -> Agent | None:
    """Get a single agent by ID, scoped to tenant."""
    result = await session.execute(
        select(Agent).where(Agent.id == agent_id, Agent.tenant_id == tenant_id)
    )
    return result.scalar_one_or_none()


async def list_agents(
    session: AsyncSession,
    tenant_id: UUID,
    page: int = 1,
    page_size: int = 20,
    status: str | None = None,
) -> tuple[list[Agent], int]:
    """List agents with pagination and optional filters."""
    query = _base_query(tenant_id)

    if status:
        query = query.where(Agent.status == status)

    count_query = select(func.count()).select_from(query.subquery())
    total_result = await session.execute(count_query)
    total = total_result.scalar_one()

    query = query.order_by(Agent.created_at.desc())
    query = query.offset((page - 1) * page_size).limit(page_size)

    result = await session.execute(query)
    items = list(result.scalars().all())
    return items, total


async def update_agent(session: AsyncSession, agent: Agent, data: dict) -> Agent:
    """Update an existing agent."""
    for key, value in data.items():
        setattr(agent, key, value)
    agent.updated_at = datetime.utcnow()
    await session.flush()
    return agent


async def delete_agent(session: AsyncSession, agent: Agent) -> None:
    """Delete an agent and its executions."""
    # Delete associated executions first
    executions = await list_executions(session, agent.id)
    for execution in executions:
        await session.delete(execution)
    await session.delete(agent)


async def create_execution(session: AsyncSession, execution: AgentExecution) -> AgentExecution:
    """Create a new execution record."""
    session.add(execution)
    await session.flush()
    return execution


async def get_execution_by_id(
    session: AsyncSession, execution_id: UUID, tenant_id: UUID
) -> AgentExecution | None:
    """Get execution by ID, scoped to tenant via agent."""
    result = await session.execute(
        select(AgentExecution)
        .join(Agent)
        .where(AgentExecution.id == execution_id, Agent.tenant_id == tenant_id)
    )
    return result.scalar_one_or_none()


async def list_executions(
    session: AsyncSession,
    agent_id: UUID,
    page: int = 1,
    page_size: int = 20,
    status: str | None = None,
) -> tuple[list[AgentExecution], int]:
    """List executions for an agent with pagination."""
    query = select(AgentExecution).where(AgentExecution.agent_id == agent_id)

    if status:
        query = query.where(AgentExecution.status == status)

    count_query = select(func.count()).select_from(query.subquery())
    total_result = await session.execute(count_query)
    total = total_result.scalar_one()

    query = query.order_by(AgentExecution.started_at.desc())
    query = query.offset((page - 1) * page_size).limit(page_size)

    result = await session.execute(query)
    items = list(result.scalars().all())
    return items, total
