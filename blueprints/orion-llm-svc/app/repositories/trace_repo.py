"""Database dependencies."""

from collections.abc import AsyncGenerator
from uuid import UUID

from sqlalchemy import select, func, distinct
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.sql import Select

from app.config import Settings
from app.models.llm_trace import LLMTrace

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
    return select(LLMTrace).where(LLMTrace.tenant_id == tenant_id)


async def create_trace(session: AsyncSession, trace: LLMTrace) -> LLMTrace:
    """Create a new trace record."""
    session.add(trace)
    await session.flush()
    return trace


async def list_traces(
    session: AsyncSession,
    tenant_id: UUID,
    page: int = 1,
    page_size: int = 20,
    model: str | None = None,
    status: str | None = None,
) -> tuple[list[LLMTrace], int]:
    """List traces with pagination and optional filters."""
    query = _base_query(tenant_id)

    if model:
        query = query.where(LLMTrace.model == model)
    if status:
        query = query.where(LLMTrace.status == status)

    count_query = select(func.count()).select_from(query.subquery())
    total_result = await session.execute(count_query)
    total = total_result.scalar_one()

    query = query.order_by(LLMTrace.created_at.desc())
    query = query.offset((page - 1) * page_size).limit(page_size)

    result = await session.execute(query)
    items = list(result.scalars().all())
    return items, total


async def get_trace_by_id(session: AsyncSession, trace_id: UUID, tenant_id: UUID) -> LLMTrace | None:
    """Get a single trace by ID, scoped to tenant."""
    result = await session.execute(
        select(LLMTrace).where(LLMTrace.id == trace_id, LLMTrace.tenant_id == tenant_id)
    )
    return result.scalar_one_or_none()


async def get_model_stats(session: AsyncSession, tenant_id: UUID) -> list[dict]:
    """Get per-model statistics."""
    stmt = (
        select(
            LLMTrace.model,
            func.count(LLMTrace.id).label("call_count"),
            func.avg(LLMTrace.tokens_used).label("avg_tokens"),
            func.sum(LLMTrace.cost).label("total_cost"),
        )
        .where(LLMTrace.tenant_id == tenant_id, LLMTrace.model.isnot(None))
        .group_by(LLMTrace.model)
        .order_by(func.sum(LLMTrace.cost).desc())
    )
    result = await session.execute(stmt)
    rows = result.fetchall()
    return [
        {
            "model": row.model,
            "call_count": row.call_count,
            "avg_tokens": round(float(row.avg_tokens), 2) if row.avg_tokens else None,
            "total_cost": float(row.total_cost) if row.total_cost else 0.0,
        }
        for row in rows
    ]


async def get_cost_summary(session: AsyncSession, tenant_id: UUID) -> dict:
    """Get tenant cost summary."""
    stmt = select(
        func.coalesce(func.sum(LLMTrace.cost), 0).label("total_cost"),
        func.coalesce(func.sum(LLMTrace.tokens_used), 0).label("total_tokens"),
        func.count(LLMTrace.id).label("total_traces"),
    ).where(LLMTrace.tenant_id == tenant_id)

    result = await session.execute(stmt)
    row = result.first()

    total_cost = float(row.total_cost) if row else 0.0
    total_tokens = int(row.total_tokens) if row else 0
    total_traces = int(row.total_traces) if row else 0

    model_breakdown = await get_model_stats(session, tenant_id)

    return {
        "total_cost": total_cost,
        "total_tokens": total_tokens,
        "total_traces": total_traces,
        "avg_cost_per_trace": round(total_cost / total_traces, 4) if total_traces > 0 else 0.0,
        "model_breakdown": model_breakdown,
    }
