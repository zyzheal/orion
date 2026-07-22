"""
AI Metric Collector 测试

验证 AI 服务指标（请求、token 消耗、错误）的记录功能。
"""

from datetime import datetime, timezone
from unittest.mock import MagicMock

import pytest

from src.models.metric_models import (
    DataPoint,
    MetricAggregation,
    MetricQuery,
    MetricRegistration,
    MetricSeries,
)
from src.services.metric_collector import MetricCollector


# ==================== Fixtures ====================


@pytest.fixture
def mock_repository():
    repo = MagicMock()
    repo.register_metric = MagicMock()
    repo.unregister_metric = MagicMock(return_value=True)
    repo.get_all_registered_metrics = MagicMock(return_value=[])
    repo.get_metric_registry = MagicMock(return_value=None)
    repo.insert_data_point = MagicMock()
    repo.query_metric_series = MagicMock(return_value=MetricSeries(
        name="test_metric",
        data_points=[],
        aggregation=MetricAggregation(),
        window_start=datetime.now(timezone.utc),
        window_end=datetime.now(timezone.utc),
    ))
    repo.get_latest_value = MagicMock(return_value=None)
    repo.prune_expired = MagicMock(return_value=0)
    repo.clear_all = MagicMock()
    return repo


@pytest.fixture
def collector(mock_repository):
    return MetricCollector(repository=mock_repository)


# ==================== record_ai_request 测试 ====================


class TestRecordAIRequest:
    """record_ai_request 方法测试"""

    def test_record_ai_request_success(self, collector, mock_repository):
        collector.record_ai_request("code-review", 120.5, True)
        assert mock_repository.insert_data_point.call_count == 2

        calls = mock_repository.insert_data_point.call_args_list
        # 第一次调用: ai.requests.count = 1.0
        first_call = calls[0]
        assert first_call.kwargs["metric_name"] == "ai.requests.count"
        assert first_call.kwargs["value"] == 1.0
        assert first_call.kwargs["tags"]["scenario"] == "code-review"
        assert first_call.kwargs["tags"]["success"] == "true"

        # 第二次调用: ai.requests.latency = 120.5
        second_call = calls[1]
        assert second_call.kwargs["metric_name"] == "ai.requests.latency"
        assert second_call.kwargs["value"] == 120.5
        assert second_call.kwargs["tags"]["scenario"] == "code-review"
        assert second_call.kwargs["tags"]["success"] == "true"

    def test_record_ai_request_failure(self, collector, mock_repository):
        collector.record_ai_request("changelog-generation", 5000.0, False)
        assert mock_repository.insert_data_point.call_count == 2

        calls = mock_repository.insert_data_point.call_args_list
        first_call = calls[0]
        assert first_call.kwargs["tags"]["success"] == "false"
        assert first_call.kwargs["tags"]["scenario"] == "changelog-generation"

    def test_record_ai_request_latency_recorded(self, collector, mock_repository):
        collector.record_ai_request("incident-summary", 42.0, True)
        calls = mock_repository.insert_data_point.call_args_list
        latency_call = calls[1]
        assert latency_call.kwargs["metric_name"] == "ai.requests.latency"
        assert latency_call.kwargs["value"] == 42.0

    def test_record_ai_request_various_scenarios(self, collector, mock_repository):
        scenarios = [
            "root-cause-diagnosis",
            "metric-anomaly-detection",
            "knowledge-extraction",
            "automation-suggestion",
        ]
        for scenario in scenarios:
            collector.record_ai_request(scenario, 100.0, True)

        assert mock_repository.insert_data_point.call_count == len(scenarios) * 2

        # 验证每个场景都被记录
        recorded_scenarios = {
            call.kwargs["tags"]["scenario"]
            for call in mock_repository.insert_data_point.call_args_list
        }
        for scenario in scenarios:
            assert scenario in recorded_scenarios

    def test_record_ai_request_zero_latency(self, collector, mock_repository):
        collector.record_ai_request("test-scenario", 0.0, True)
        calls = mock_repository.insert_data_point.call_args_list
        latency_call = calls[1]
        assert latency_call.kwargs["value"] == 0.0


# ==================== record_ai_token_usage 测试 ====================


class TestRecordAITokenUsage:
    """record_ai_token_usage 方法测试"""

    def test_record_token_usage_basic(self, collector, mock_repository):
        collector.record_ai_token_usage("gpt-4", 100, 50)
        assert mock_repository.insert_data_point.call_count == 2

        calls = mock_repository.insert_data_point.call_args_list
        # 第一次: prompt tokens
        prompt_call = calls[0]
        assert prompt_call.kwargs["metric_name"] == "ai.tokens.prompt"
        assert prompt_call.kwargs["value"] == 100.0
        assert prompt_call.kwargs["tags"]["model"] == "gpt-4"
        assert prompt_call.kwargs["tags"]["type"] == "prompt"

        # 第二次: completion tokens
        completion_call = calls[1]
        assert completion_call.kwargs["metric_name"] == "ai.tokens.completion"
        assert completion_call.kwargs["value"] == 50.0
        assert completion_call.kwargs["tags"]["model"] == "gpt-4"
        assert completion_call.kwargs["tags"]["type"] == "completion"

    def test_record_token_usage_different_models(self, collector, mock_repository):
        models = ["gpt-4", "gpt-3.5-turbo", "claude-3", "ollama/llama2"]
        for model in models:
            collector.record_ai_token_usage(model, 200, 100)

        assert mock_repository.insert_data_point.call_count == len(models) * 2

        recorded_models = {
            call.kwargs["tags"]["model"]
            for call in mock_repository.insert_data_point.call_args_list
        }
        for model in models:
            assert model in recorded_models

    def test_record_token_usage_zero_tokens(self, collector, mock_repository):
        collector.record_ai_token_usage("test-model", 0, 0)
        assert mock_repository.insert_data_point.call_count == 2

        calls = mock_repository.insert_data_point.call_args_list
        assert calls[0].kwargs["value"] == 0.0
        assert calls[1].kwargs["value"] == 0.0

    def test_record_token_usage_large_numbers(self, collector, mock_repository):
        collector.record_ai_token_usage("gpt-4-32k", 32000, 16000)
        calls = mock_repository.insert_data_point.call_args_list
        assert calls[0].kwargs["value"] == 32000.0
        assert calls[1].kwargs["value"] == 16000.0


# ==================== record_ai_error 测试 ====================


class TestRecordAIError:
    """record_ai_error 方法测试"""

    def test_record_ai_error_basic(self, collector, mock_repository):
        collector.record_ai_error("code-review", "timeout")
        mock_repository.insert_data_point.assert_called_once()
        call_args = mock_repository.insert_data_point.call_args
        assert call_args.kwargs["metric_name"] == "ai.errors.count"
        assert call_args.kwargs["value"] == 1.0
        assert call_args.kwargs["tags"]["scenario"] == "code-review"
        assert call_args.kwargs["tags"]["error_type"] == "timeout"

    def test_record_ai_error_various_error_types(self, collector, mock_repository):
        error_types = [
            "timeout",
            "rate_limit_exceeded",
            "api_error",
            "model_overloaded",
            "connection_error",
        ]
        for error_type in error_types:
            collector.record_ai_error("text-generation", error_type)

        assert mock_repository.insert_data_point.call_count == len(error_types)

        recorded_errors = {
            call.kwargs["tags"]["error_type"]
            for call in mock_repository.insert_data_point.call_args_list
        }
        for error_type in error_types:
            assert error_type in recorded_errors

    def test_record_ai_error_scenario_preserved(self, collector, mock_repository):
        collector.record_ai_error("alert-correlation", "inference_error")
        call_args = mock_repository.insert_data_point.call_args
        assert call_args.kwargs["tags"]["scenario"] == "alert-correlation"

    def test_record_ai_error_empty_error_type(self, collector, mock_repository):
        collector.record_ai_error("test-scenario", "")
        mock_repository.insert_data_point.assert_called_once()
        call_args = mock_repository.insert_data_point.call_args
        assert call_args.kwargs["tags"]["error_type"] == ""


# ==================== 集成场景测试 ====================


class TestAIMetricsIntegration:
    """AI 指标记录集成场景测试"""

    def test_full_request_lifecycle(self, collector, mock_repository):
        """模拟一次完整的 AI 请求生命周期指标记录"""
        # 请求成功
        collector.record_ai_request("code-review", 150.0, True)
        # token 消耗
        collector.record_ai_token_usage("gpt-4", 500, 200)
        # 另一个请求
        collector.record_ai_request("code-review", 200.0, True)
        # 请求失败
        collector.record_ai_error("code-review", "timeout")
        # token 消耗
        collector.record_ai_token_usage("gpt-4", 300, 150)

        # 请求成功 × 2(请求记录) + token × 2(每次) + 请求失败 × 2(请求记录) + token × 2
        # = 2 + 2 + 2 + 2 + 1 = 9 (error 只记 1 个)
        assert mock_repository.insert_data_point.call_count == 9

        calls = mock_repository.insert_data_point.call_args_list
        metric_names = [call.kwargs["metric_name"] for call in calls]
        assert metric_names.count("ai.requests.count") == 2
        assert metric_names.count("ai.requests.latency") == 2
        assert metric_names.count("ai.tokens.prompt") == 2
        assert metric_names.count("ai.tokens.completion") == 2
        assert metric_names.count("ai.errors.count") == 1

    def test_request_with_tags_queryable(self, collector, mock_repository):
        """验证记录的指标带标签，可后续查询"""
        collector.record_ai_request("code-review", 100.0, True)
        calls = mock_repository.insert_data_point.call_args_list
        for call in calls:
            assert "scenario" in call.kwargs["tags"]
            assert "success" in call.kwargs["tags"]

    def test_multiple_models_token_tracking(self, collector, mock_repository):
        """验证多模型 token 追踪"""
        models_usage = [
            ("gpt-4", 1000, 500),
            ("gpt-3.5-turbo", 2000, 1000),
            ("claude-3-opus", 500, 300),
        ]
        for model, prompt_tokens, completion_tokens in models_usage:
            collector.record_ai_token_usage(model, prompt_tokens, completion_tokens)

        assert mock_repository.insert_data_point.call_count == len(models_usage) * 2

        # 验证每个模型的 token 值正确
        call_values = [
            (call.kwargs["tags"]["model"], call.kwargs["metric_name"], call.kwargs["value"])
            for call in mock_repository.insert_data_point.call_args_list
        ]
        expected = []
        for model, prompt, completion in models_usage:
            expected.append((model, "ai.tokens.prompt", float(prompt)))
            expected.append((model, "ai.tokens.completion", float(completion)))

        assert call_values == expected

    def test_error_tracking_with_context(self, collector, mock_repository):
        """验证错误追踪带场景上下文"""
        errors = [
            ("code-review", "rate_limit_exceeded"),
            ("code-review", "api_error"),
            ("diagnosis", "timeout"),
        ]
        for scenario, error_type in errors:
            collector.record_ai_error(scenario, error_type)

        assert mock_repository.insert_data_point.call_count == len(errors)
        for i, (scenario, error_type) in enumerate(errors):
            call = mock_repository.insert_data_point.call_args_list[i]
            assert call.kwargs["tags"]["scenario"] == scenario
            assert call.kwargs["tags"]["error_type"] == error_type
