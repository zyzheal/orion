"""LLM Trace API routes."""

from uuid import UUID

from fastapi import APIRouter, HTTPException, Query

from ..models.schemas import (
    DailyStats,
    LLMTrace,
    TraceCompleteRequest,
    TraceListParams,
    TraceStartRequest,
    TraceStatus,
)
from ..services.trace_service import TraceService

router = APIRouter(prefix="/api/v1/traces", tags=["traces"])
service = TraceService()


@router.post("", status_code=201, response_model=LLMTrace)
async def start_trace(req: TraceStartRequest, tenant_id: str = "default"):
    return service.start_trace(tenant_id, req)


@router.get("", response_model=list[LLMTrace])
async def list_traces(
    tenant_id: str = "default",
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    model_id: str | None = None,
    status: TraceStatus | None = None,
):
    params = TraceListParams(
        page=page, page_size=page_size, model_id=model_id, status=status
    )
    return service.list_traces(tenant_id, params)


@router.get("/{trace_id}", response_model=LLMTrace)
async def get_trace(trace_id: UUID):
    trace = service.get_trace(trace_id)
    if not trace:
        raise HTTPException(status_code=404, detail="trace not found")
    return trace


@router.post("/{trace_id}/complete", response_model=LLMTrace)
async def complete_trace(trace_id: UUID, req: TraceCompleteRequest):
    try:
        return service.complete_trace(trace_id, req)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/stats/daily", response_model=DailyStats)
async def get_daily_stats(
    date: str = Query(..., description="Date in YYYY-MM-DD format"),
    tenant_id: str = "default",
):
    return service.get_daily_stats(tenant_id, date)
