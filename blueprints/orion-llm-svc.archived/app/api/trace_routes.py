"""API routes for LLM trace management."""

from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_session
from app.schemas.trace import CostSummary, ModelListResponse, TraceCreate, TraceListResponse, TraceResponse
from app.services.trace_service import TraceService

router = APIRouter(prefix="/api/v1", tags=["llm-traces"])
trace_service = TraceService()


@router.post("/traces", response_model=TraceResponse, status_code=201)
async def create_trace(
    data: TraceCreate,
    session: AsyncSession = Depends(get_session),
):
    """Report a new LLM trace."""
    return await trace_service.create_trace(session, data)


@router.get("/traces", response_model=TraceListResponse)
async def list_traces(
    tenant_id: UUID = Query(..., description="Tenant identifier"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    model: str | None = Query(None),
    status: str | None = Query(None),
    session: AsyncSession = Depends(get_session),
):
    """List LLM traces with pagination and filters."""
    return await trace_service.list_traces(
        session, tenant_id, page=page, page_size=page_size, model=model, status=status
    )


@router.get("/traces/{trace_id}", response_model=TraceResponse)
async def get_trace(
    trace_id: UUID,
    tenant_id: UUID = Query(..., description="Tenant identifier"),
    session: AsyncSession = Depends(get_session),
):
    """Get trace detail by ID."""
    trace = await trace_service.get_trace(session, trace_id, tenant_id)
    if trace is None:
        from fastapi import HTTPException

        raise HTTPException(status_code=404, detail="Trace not found")
    return trace


@router.get("/models", response_model=ModelListResponse)
async def list_models(
    tenant_id: UUID = Query(..., description="Tenant identifier"),
    session: AsyncSession = Depends(get_session),
):
    """List models used by the tenant with usage stats."""
    return await trace_service.get_models(session, tenant_id)


@router.get("/cost-summary", response_model=CostSummary)
async def get_cost_summary(
    tenant_id: UUID = Query(..., description="Tenant identifier"),
    session: AsyncSession = Depends(get_session),
):
    """Get cost summary for the tenant."""
    return await trace_service.get_cost_summary(session, tenant_id)
