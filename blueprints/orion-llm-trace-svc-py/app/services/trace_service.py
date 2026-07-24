"""LLM Trace service - business logic for trace operations."""

import hashlib
from datetime import datetime, timedelta
from typing import Optional
from uuid import UUID, uuid4

from ..models.schemas import (
    DailyStats,
    LLMTrace,
    TraceCompleteRequest,
    TraceListParams,
    TraceStartRequest,
    TraceStatus,
)

# Model pricing (CNY per token)
MODEL_PRICING = {
    "gpt-4": {"input": 0.002, "output": 0.004},
    "gpt-4-turbo": {"input": 0.001, "output": 0.002},
    "gpt-3.5-turbo": {"input": 0.0003, "output": 0.0006},
    "claude-opus": {"input": 0.003, "output": 0.006},
    "claude-sonnet": {"input": 0.001, "output": 0.002},
    "claude-haiku": {"input": 0.0003, "output": 0.0006},
    "qwen-max": {"input": 0.0005, "output": 0.001},
    "deepseek": {"input": 0.0003, "output": 0.0006},
}


class TraceService:
    """Service for managing LLM traces."""

    def __init__(self):
        self._traces: dict[UUID, LLMTrace] = {}

    def start_trace(self, tenant_id: str, req: TraceStartRequest) -> LLMTrace:
        trace = LLMTrace(
            id=uuid4(),
            tenant_id=tenant_id,
            user_id=req.user_id,
            scenario_id=req.scenario_id,
            provider_id=req.provider_id,
            model_id=req.model_id,
            prompt_content=req.prompt_content,
            prompt_hash=hashlib.sha256(req.prompt_content.encode()).hexdigest()[:16],
            parent_trace_id=req.parent_trace_id,
            request_context=req.request_context,
        )
        self._traces[trace.id] = trace
        return trace

    def complete_trace(self, trace_id: UUID, req: TraceCompleteRequest) -> LLMTrace:
        trace = self._traces.get(trace_id)
        if not trace:
            raise ValueError(f"Trace not found: {trace_id}")

        pricing = MODEL_PRICING.get(trace.model_id, {"input": 0.001, "output": 0.002})
        input_cost = req.input_tokens * pricing["input"]
        output_cost = req.output_tokens * pricing["output"]

        trace.output_content = req.output_content
        output_hash = hashlib.sha256(req.output_content.encode()).hexdigest()[:16]
        trace.output_hash = output_hash
        trace.input_tokens = req.input_tokens
        trace.output_tokens = req.output_tokens
        trace.total_tokens = req.input_tokens + req.output_tokens
        trace.input_cost = input_cost
        trace.output_cost = output_cost
        trace.total_cost = input_cost + output_cost
        trace.request_completed_at = datetime.utcnow()
        trace.duration_ms = int(
            (trace.request_completed_at - trace.request_started_at).total_seconds() * 1000
        )

        if req.error_message:
            trace.status = TraceStatus.FAILED
            trace.error_message = req.error_message
        else:
            trace.status = TraceStatus.COMPLETED

        return trace

    def get_trace(self, trace_id: UUID) -> Optional[LLMTrace]:
        return self._traces.get(trace_id)

    def list_traces(
        self, tenant_id: str, params: TraceListParams
    ) -> list[LLMTrace]:
        traces = [t for t in self._traces.values() if t.tenant_id == tenant_id]
        if params.model_id:
            traces = [t for t in traces if t.model_id == params.model_id]
        if params.status:
            traces = [t for t in traces if t.status == params.status]
        traces.sort(key=lambda t: t.request_started_at, reverse=True)
        offset = (params.page - 1) * params.page_size
        return traces[offset : offset + params.page_size]

    def get_daily_stats(self, tenant_id: str, date: str) -> DailyStats:
        target = datetime.strptime(date, "%Y-%m-%d").date()
        traces = [
            t
            for t in self._traces.values()
            if t.tenant_id == tenant_id and t.request_started_at.date() == target
        ]
        stats = DailyStats(date=date)
        stats.total_requests = len(traces)
        stats.total_tokens = sum(t.total_tokens for t in traces)
        stats.total_cost = sum(t.total_cost for t in traces)
        for t in traces:
            if t.model_id not in stats.model_breakdown:
                stats.model_breakdown[t.model_id] = {
                    "requests": 0,
                    "tokens": 0,
                    "cost": 0.0,
                }
            stats.model_breakdown[t.model_id]["requests"] += 1
            stats.model_breakdown[t.model_id]["tokens"] += t.total_tokens
            stats.model_breakdown[t.model_id]["cost"] += t.total_cost
        return stats
