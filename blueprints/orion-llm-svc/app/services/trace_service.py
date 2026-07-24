"""LLM trace business logic service."""

from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.llm_trace import LLMTrace
from app.repositories import trace_repo
from app.schemas.trace import (
    CostSummary,
    ModelInfo,
    ModelListResponse,
    TraceCreate,
    TraceListResponse,
    TraceResponse,
)


class TraceService:
    """Service layer for LLM trace operations."""

    async def create_trace(self, session: AsyncSession, data: TraceCreate) -> TraceResponse:
        """Create a new LLM trace."""
        trace = LLMTrace(
            tenant_id=data.tenant_id,
            trace_id=data.trace_id,
            model=data.model,
            prompt=data.prompt,
            response=data.response,
            tokens_used=data.tokens_used,
            cost=data.cost,
            status=data.status,
        )
        created = await trace_repo.create_trace(session, trace)
        return TraceResponse(**created.to_dict())

    async def list_traces(
        self,
        session: AsyncSession,
        tenant_id: UUID,
        page: int = 1,
        page_size: int = 20,
        model: str | None = None,
        status: str | None = None,
    ) -> TraceListResponse:
        """List traces with pagination."""
        items, total = await trace_repo.list_traces(
            session, tenant_id, page=page, page_size=page_size, model=model, status=status
        )
        return TraceListResponse(
            items=[TraceResponse(**t.to_dict()) for t in items],
            total=total,
            page=page,
            page_size=page_size,
        )

    async def get_trace(self, session: AsyncSession, trace_id: UUID, tenant_id: UUID) -> TraceResponse | None:
        """Get a single trace by ID."""
        trace = await trace_repo.get_trace_by_id(session, trace_id, tenant_id)
        if trace is None:
            return None
        return TraceResponse(**trace.to_dict())

    async def get_models(self, session: AsyncSession, tenant_id: UUID) -> ModelListResponse:
        """Get list of models used by tenant with stats."""
        stats = await trace_repo.get_model_stats(session, tenant_id)
        return ModelListResponse(
            items=[ModelInfo(**s) for s in stats],
            total_models=len(stats),
        )

    async def get_cost_summary(self, session: AsyncSession, tenant_id: UUID) -> CostSummary:
        """Get cost summary for a tenant."""
        summary = await trace_repo.get_cost_summary(session, tenant_id)
        summary["model_breakdown"] = [ModelInfo(**m) for m in summary["model_breakdown"]]
        return CostSummary(**summary)
