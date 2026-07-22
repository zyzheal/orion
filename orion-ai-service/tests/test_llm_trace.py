"""
LLMTraceService 测试

覆盖 start_trace, end_trace, get_trace, list_traces 核心功能。
"""

from datetime import datetime, timezone, timedelta
from unittest.mock import MagicMock

import pytest

from src.models.trace import LLMTraceRecord
from src.repositories.llm_trace_repository import (
    LLMTraceRepository,
    InMemoryLLMTraceRepository,
)
from src.services.llm_trace import LLMTraceService


# ==================== Fixtures ====================


@pytest.fixture
def mock_repository():
    repo = MagicMock(spec=LLMTraceRepository)
    repo.save_trace = MagicMock()
    repo.get_trace = MagicMock(return_value=None)
    repo.list_traces = MagicMock(return_value=[])
    return repo


@pytest.fixture
def trace_service(mock_repository):
    return LLMTraceService(repository=mock_repository)


# ==================== start_trace 测试 ====================


class TestStartTrace:
    """start_trace 功能测试"""

    def test_start_trace_creates_record(self, trace_service):
        trace_service.start_trace(
            trace_id="trace-001",
            model="gpt-4",
            prompt="Hello, world!",
            metadata={"user_id": "user-123"},
        )

        trace = trace_service.get_trace("trace-001")
        assert trace is not None
        assert trace.trace_id == "trace-001"
        assert trace.model == "gpt-4"
        assert trace.prompt == "Hello, world!"
        assert trace.response == ""
        assert trace.tokens_prompt == 0
        assert trace.tokens_completion == 0
        assert trace.latency_ms == 0
        assert trace.metadata == {"user_id": "user-123"}

    def test_start_trace_empty_metadata(self, trace_service):
        trace_service.start_trace(
            trace_id="trace-002",
            model="claude-3",
            prompt="Test",
            metadata={},
        )

        trace = trace_service.get_trace("trace-002")
        assert trace.metadata == {}

    def test_start_trace_none_metadata(self, trace_service):
        trace_service.start_trace(
            trace_id="trace-003",
            model="gpt-3.5",
            prompt="Test",
            metadata=None,
        )

        trace = trace_service.get_trace("trace-003")
        assert trace.metadata == {}


# ==================== end_trace 测试 ====================


class TestEndTrace:
    """end_trace 功能测试"""

    def test_end_trace_updates_record(self, trace_service, mock_repository):
        trace_service.start_trace(
            trace_id="trace-100",
            model="gpt-4",
            prompt="Explain Python",
            metadata={},
        )
        trace_service.end_trace(
            trace_id="trace-100",
            response="Python is a programming language.",
            tokens_used={"prompt": 10, "completion": 20},
            latency_ms=150,
        )

        trace = trace_service.get_trace("trace-100")
        assert trace.response == "Python is a programming language."
        assert trace.tokens_prompt == 10
        assert trace.tokens_completion == 20
        assert trace.latency_ms == 150
        mock_repository.save_trace.assert_called_once()

    def test_end_trace_persists_to_repository(self, trace_service, mock_repository):
        trace_service.start_trace("trace-101", "gpt-4", "Test", {})
        trace_service.end_trace(
            "trace-101",
            "Response",
            {"prompt": 5, "completion": 10},
            200,
        )

        saved_trace = mock_repository.save_trace.call_args[0][0]
        assert saved_trace.trace_id == "trace-101"
        assert saved_trace.tokens_completion == 10
        assert saved_trace.latency_ms == 200

    def test_end_trace_missing_trace_id(self, trace_service):
        # 不调用 start_trace，直接 end_trace
        trace_service.end_trace(
            "nonexistent-trace",
            "Response",
            {"prompt": 1, "completion": 1},
            50,
        )
        # 不应抛出异常，只记录 warning
        assert trace_service.get_trace("nonexistent-trace") is None


# ==================== get_trace 测试 ====================


class TestGetTrace:
    """get_trace 功能测试"""

    def test_get_trace_exists_in_memory(self, trace_service):
        trace_service.start_trace("trace-200", "claude-3", "Test prompt", {})
        trace = trace_service.get_trace("trace-200")
        assert trace is not None
        assert trace.trace_id == "trace-200"

    def test_get_trace_not_found(self, trace_service):
        trace = trace_service.get_trace("nonexistent")
        assert trace is None

    def test_get_trace_from_repository_fallback(self, trace_service, mock_repository):
        # 内存中没有，从仓储获取
        repo_trace = LLMTraceRecord(
            trace_id="repo-trace",
            model="gpt-4",
            prompt="Repo prompt",
            response="Repo response",
            tokens_prompt=5,
            tokens_completion=15,
            latency_ms=100,
            metadata={},
        )
        mock_repository.get_trace.return_value = repo_trace

        trace = trace_service.get_trace("repo-trace")
        assert trace is repo_trace
        mock_repository.get_trace.assert_called_with("repo-trace")


# ==================== list_traces 测试 ====================


class TestListTraces:
    """list_traces 功能测试"""

    def test_list_traces_empty(self, trace_service):
        result = trace_service.list_traces()
        assert result == []

    def test_list_traces_returns_all(self, trace_service):
        now = datetime.now(timezone.utc)
        for i in range(5):
            trace_service.start_trace(
                f"trace-{i}",
                "gpt-4",
                f"Prompt {i}",
                {},
            )
            trace_service.end_trace(
                f"trace-{i}",
                f"Response {i}",
                {"prompt": i, "completion": i * 2},
                i * 100,
            )

        result = trace_service.list_traces(limit=100)
        assert len(result) == 5

    def test_list_traces_sorted_by_created_at_desc(self, trace_service):
        base_time = datetime.now(timezone.utc)
        for i in range(3):
            trace_service.start_trace(
                f"trace-sort-{i}",
                "gpt-4",
                f"Prompt {i}",
                {},
            )

        result = trace_service.list_traces()
        # 最新创建的应该在最前面
        assert result[0].trace_id == "trace-sort-2"

    def test_list_traces_filter_by_model(self, trace_service, mock_repository):
        trace_service.start_trace("t1", "gpt-4", "P1", {})
        trace_service.start_trace("t2", "claude-3", "P2", {})
        trace_service.start_trace("t3", "gpt-4", "P3", {})

        result = trace_service.list_traces(model="gpt-4")
        assert len(result) == 2
        for trace in result:
            assert trace.model == "gpt-4"

    def test_list_traces_filter_by_time(self, trace_service):
        now = datetime.now(timezone.utc)
        old_time = now - timedelta(hours=2)

        # 先创建旧记录
        trace_service.start_trace("old-trace", "gpt-4", "Old", {})
        # 修改 created_at 模拟旧记录
        trace_service._traces["old-trace"].created_at = old_time

        # 创建新记录
        trace_service.start_trace("new-trace", "gpt-4", "New", {})

        start = now - timedelta(hours=1)
        result = trace_service.list_traces(start_time=start)
        assert len(result) == 1
        assert result[0].trace_id == "new-trace"

    def test_list_traces_limit(self, trace_service):
        for i in range(20):
            trace_service.start_trace(f"trace-limit-{i}", "gpt-4", f"P{i}", {})
            trace_service.end_trace(
                f"trace-limit-{i}",
                f"R{i}",
                {"prompt": i, "completion": i},
                i * 10,
            )

        result = trace_service.list_traces(limit=5)
        assert len(result) == 5


# ==================== 仓储实现测试 ====================


class TestInMemoryLLMTraceRepository:
    """InMemoryLLMTraceRepository 功能测试"""

    def test_save_and_get_trace(self):
        repo = InMemoryLLMTraceRepository()
        trace = LLMTraceRecord(
            trace_id="repo-1",
            model="gpt-4",
            prompt="Hello",
            response="Hi there",
            tokens_prompt=5,
            tokens_completion=10,
            latency_ms=120,
            metadata={"env": "test"},
        )
        repo.save_trace(trace)

        result = repo.get_trace("repo-1")
        assert result is trace
        assert result.response == "Hi there"

    def test_list_traces_empty(self):
        repo = InMemoryLLMTraceRepository()
        assert repo.list_traces() == []

    def test_list_traces_with_filters(self):
        repo = InMemoryLLMTraceRepository()
        base = datetime.now(timezone.utc)

        for i in range(3):
            trace = LLMTraceRecord(
                trace_id=f"filter-{i}",
                model="gpt-4" if i < 2 else "claude-3",
                prompt=f"P{i}",
                response=f"R{i}",
                latency_ms=100,
                metadata={},
                created_at=base - timedelta(minutes=i),
            )
            repo.save_trace(trace)

        # 按模型过滤
        gpt_traces = repo.list_traces(model="gpt-4")
        assert len(gpt_traces) == 2

        # 按时间过滤
        recent = repo.list_traces(start_time=base - timedelta(minutes=1))
        assert len(recent) == 2  # base 和 base-1min
