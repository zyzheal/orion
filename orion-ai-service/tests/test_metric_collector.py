"""
MetricCollector 测试

验证指标采集、注册、记录、查询、聚合统计等核心功能。
"""

from datetime import datetime, timezone, timedelta
from unittest.mock import MagicMock

import pytest

from src.models.metric_models import (
    DataPoint,
    Metric,
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


# ==================== 指标注册测试 ====================


class TestMetricRegistration:
    """指标注册功能测试"""

    def test_register_metric(self, collector, mock_repository):
        collector.register_metric(MetricRegistration(
            name="test.metric",
            unit="count",
            default_tags={"env": "test"},
            description="Test metric",
        ))
        assert "test.metric" in collector.get_registered_metrics()
        mock_repository.register_metric.assert_called_once()

    def test_unregister_metric(self, collector, mock_repository):
        collector.register_metric(MetricRegistration(name="temp.metric", unit="count"))
        result = collector.unregister_metric("temp.metric")
        assert result is True
        assert "temp.metric" not in collector.get_registered_metrics()

    def test_get_registered_metrics_empty(self, collector):
        assert collector.get_registered_metrics() == []


# ==================== 指标记录测试 ====================


class TestMetricRecording:
    """指标记录功能测试"""

    def test_record_metric_basic(self, collector, mock_repository):
        collector.record_metric("cpu.usage", 75.5, {"host": "server-1"})
        latest = collector.get_latest_value("cpu.usage")
        assert latest == 75.5
        mock_repository.insert_data_point.assert_called_once()

    def test_record_multiple_points(self, collector, mock_repository):
        now = datetime.now(timezone.utc)
        collector.record_metric("latency", 10.0, timestamp=now)
        collector.record_metric("latency", 20.0, timestamp=now + timedelta(seconds=1))
        collector.record_metric("latency", 30.0, timestamp=now + timedelta(seconds=2))

        series = collector.get_metric_series(MetricQuery(name="latency"))
        assert len(series.data_points) == 3
        assert series.aggregation.count == 3

    def test_record_latency(self, collector, mock_repository):
        collector.record_latency("/api/test", 150.0, 200)
        mock_repository.insert_data_point.assert_called_once()
        call_args = mock_repository.insert_data_point.call_args
        assert call_args.kwargs["metric_name"] == "app.http.latency"
        assert call_args.kwargs["value"] == 150.0
        assert call_args.kwargs["tags"]["endpoint"] == "/api/test"
        assert call_args.kwargs["tags"]["status_code"] == "200"

    def test_record_error(self, collector, mock_repository):
        collector.record_error("auth-service", "timeout")
        mock_repository.insert_data_point.assert_called_once()
        call_args = mock_repository.insert_data_point.call_args
        assert call_args.kwargs["metric_name"] == "app.errors.count"
        assert call_args.kwargs["value"] == 1.0

    def test_record_throughput(self, collector, mock_repository):
        collector.record_throughput("api-gateway", 100.0)
        mock_repository.insert_data_point.assert_called_once()
        call_args = mock_repository.insert_data_point.call_args
        assert call_args.kwargs["metric_name"] == "app.throughput"
        assert call_args.kwargs["value"] == 100.0

    def test_record_nats_message_rate(self, collector, mock_repository):
        collector.record_nats_message_rate("events.pipeline", 5.0)
        counts = collector.get_nats_message_counts()
        assert counts["events.pipeline"] == 5
        mock_repository.insert_data_point.assert_called_once()


# ==================== 时间序列查询测试 ====================


class TestMetricQuery:
    """指标查询功能测试"""

    def test_get_metric_series_empty(self, collector):
        series = collector.get_metric_series(MetricQuery(name="nonexistent"))
        assert len(series.data_points) == 0
        assert series.aggregation.count == 0

    def test_get_metric_series_with_data(self, collector, mock_repository):
        now = datetime.now(timezone.utc)
        for i in range(10):
            collector.record_metric("requests", float(i), timestamp=now + timedelta(seconds=i))

        series = collector.get_metric_series(MetricQuery(name="requests"))
        assert len(series.data_points) == 10
        assert series.aggregation.count == 10

    def test_get_metric_series_with_tag_filter(self, collector):
        now = datetime.now(timezone.utc)
        collector.record_metric("latency", 100.0, {"endpoint": "/api/a"}, now)
        collector.record_metric("latency", 200.0, {"endpoint": "/api/b"}, now + timedelta(seconds=1))

        series = collector.get_metric_series(MetricQuery(name="latency", tags={"endpoint": "/api/a"}))
        assert len(series.data_points) == 1
        assert series.data_points[0].value == 100.0

    def test_get_metric_series_with_time_window(self, collector):
        now = datetime.now(timezone.utc)
        collector.record_metric("events", 1.0, timestamp=now - timedelta(hours=2))
        collector.record_metric("events", 2.0, timestamp=now - timedelta(hours=1))
        collector.record_metric("events", 3.0, timestamp=now)

        start = now - timedelta(hours=1, minutes=30)
        end = now - timedelta(minutes=30)
        series = collector.get_metric_series(MetricQuery(name="events", start_time=start, end_time=end))
        assert len(series.data_points) == 1
        assert series.data_points[0].value == 2.0

    def test_get_metric_series_max_points(self, collector):
        now = datetime.now(timezone.utc)
        for i in range(100):
            collector.record_metric("samples", float(i), timestamp=now + timedelta(seconds=i))

        series = collector.get_metric_series(MetricQuery(name="samples", max_points=10))
        assert len(series.data_points) <= 10


# ==================== 聚合统计测试 ====================


class TestMetricAggregation:
    """聚合统计测试"""

    def test_aggregation_basic(self, collector):
        now = datetime.now(timezone.utc)
        values = [10.0, 20.0, 30.0, 40.0, 50.0]
        for v in values:
            collector.record_metric("test", v, timestamp=now)

        series = collector.get_metric_series(MetricQuery(name="test"))
        agg = series.aggregation
        assert agg.count == 5
        assert agg.sum == 150.0
        assert agg.avg == 30.0
        assert agg.max == 50.0
        assert agg.min == 10.0

    def test_aggregation_single_value(self, collector):
        collector.record_metric("single", 42.0)
        series = collector.get_metric_series(MetricQuery(name="single"))
        agg = series.aggregation
        assert agg.count == 1
        assert agg.avg == 42.0
        assert agg.max == 42.0
        assert agg.min == 42.0

    def test_get_metric_summary(self, collector):
        now = datetime.now(timezone.utc)
        for i in range(5):
            collector.record_metric("summary_test", float(i * 10), timestamp=now + timedelta(seconds=i))

        summary = collector.get_metric_summary("summary_test")
        assert summary.count == 5
        assert summary.sum == 100.0


# ==================== 最新值测试 ====================


class TestLatestValue:
    """最新值查询测试"""

    def test_get_latest_value_exists(self, collector):
        now = datetime.now(timezone.utc)
        collector.record_metric("current", 99.0, timestamp=now)
        latest = collector.get_latest_value("current")
        assert latest == 99.0

    def test_get_latest_value_not_found(self, collector):
        latest = collector.get_latest_value("nonexistent")
        assert latest is None

    def test_get_latest_value_with_tags(self, collector):
        now = datetime.now(timezone.utc)
        collector.record_metric("temp", 10.0, {"type": "a"}, now)
        collector.record_metric("temp", 20.0, {"type": "b"}, now + timedelta(seconds=1))

        latest_a = collector.get_latest_value("temp", {"type": "a"})
        assert latest_a == 10.0

        latest_b = collector.get_latest_value("temp", {"type": "b"})
        assert latest_b == 20.0


# ==================== 维护功能测试 ====================


class TestMaintenance:
    """维护功能测试"""

    def test_prune_expired(self, collector, mock_repository):
        # Disable in-memory retention so expired points survive until prune_expired
        collector._enforce_retention = lambda name: None
        now = datetime.now(timezone.utc)
        # 添加过期数据（24小时前）
        old_ts = now - timedelta(hours=25)
        collector.record_metric("old_metric", 1.0, timestamp=old_ts)
        # 添加有效数据
        collector.record_metric("old_metric", 2.0, timestamp=now)

        collector._retention_ms = 24 * 60 * 60 * 1000  # 24 hours
        pruned = collector.prune_expired()
        # 至少清理了 1 个过期点
        assert pruned >= 1

    def test_clear_all(self, collector, mock_repository):
        now = datetime.now(timezone.utc)
        collector.record_metric("temp", 1.0, timestamp=now)
        collector.register_metric(MetricRegistration(name="temp", unit="count"))

        collector.clear_all()
        assert len(collector.get_registered_metrics()) == 0
        mock_repository.clear_all.assert_called_once_with("default")


# ==================== 系统指标采集测试 ====================


class TestSystemMetrics:
    """系统指标采集测试"""

    def test_collect_system_metrics(self, collector, mock_repository):
        metrics = collector.collect_system_metrics()
        names = [m.name for m in metrics]
        assert "system.cpu.usage" in names
        assert "system.memory.usage" in names
        assert "system.load.1m" in names
        assert "system.load.5m" in names
        assert "system.load.15m" in names

    def test_get_cpu_usage(self, collector):
        usage = collector._get_cpu_usage()
        assert 0.0 <= usage <= 100.0

    def test_get_memory_usage(self, collector):
        mem = collector._get_memory_usage()
        assert "used" in mem
        assert "total" in mem
        assert "percent" in mem
        assert mem["total"] > 0

    def test_get_disk_usage(self, collector):
        disk = collector._get_disk_usage()
        assert "percent" in disk

    def test_get_network_stats(self, collector):
        net = collector._get_network_stats()
        assert "bytes_recv" in net
        assert "bytes_sent" in net
