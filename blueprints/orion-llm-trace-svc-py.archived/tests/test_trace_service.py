"""Tests for trace service."""

import pytest
from app.models.schemas import TraceCompleteRequest, TraceListParams, TraceStartRequest, TraceStatus
from app.services.trace_service import TraceService


@pytest.fixture
def service():
    return TraceService()


def test_start_trace(service):
    req = TraceStartRequest(model_id="gpt-4", prompt_content="Hello")
    trace = service.start_trace("t1", req)
    assert trace.tenant_id == "t1"
    assert trace.model_id == "gpt-4"
    assert trace.status == TraceStatus.PENDING
    assert trace.prompt_hash is not None


def test_complete_trace(service):
    req = TraceStartRequest(model_id="gpt-4", prompt_content="Hello")
    trace = service.start_trace("t1", req)

    complete = TraceCompleteRequest(
        output_content="World", input_tokens=10, output_tokens=20
    )
    result = service.complete_trace(trace.id, complete)
    assert result.status == TraceStatus.COMPLETED
    assert result.total_tokens == 30
    assert result.total_cost > 0


def test_complete_trace_with_error(service):
    req = TraceStartRequest(model_id="gpt-4", prompt_content="Hello")
    trace = service.start_trace("t1", req)

    complete = TraceCompleteRequest(
        output_content="", input_tokens=0, output_tokens=0, error_message="timeout"
    )
    result = service.complete_trace(trace.id, complete)
    assert result.status == TraceStatus.FAILED
    assert result.error_message == "timeout"


def test_list_traces(service):
    for i in range(5):
        req = TraceStartRequest(model_id="gpt-4", prompt_content=f"msg {i}")
        service.start_trace("t1", req)

    traces = service.list_traces("t1", TraceListParams(page=1, page_size=3))
    assert len(traces) == 3


def test_daily_stats(service):
    req = TraceStartRequest(model_id="gpt-4", prompt_content="Hello")
    trace = service.start_trace("t1", req)
    complete = TraceCompleteRequest(
        output_content="World", input_tokens=10, output_tokens=20
    )
    service.complete_trace(trace.id, complete)

    from datetime import datetime

    stats = service.get_daily_stats("t1", datetime.utcnow().strftime("%Y-%m-%d"))
    assert stats.total_requests == 1
    assert stats.total_tokens == 30
