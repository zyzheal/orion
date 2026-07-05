"""
Metric Collector 服务

收集系统指标和应用指标，支持 PostgreSQL 持久化。
对应 TS: src/services/monitoring/MetricCollector.ts
"""

import logging
import os
import socket
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from src.models.metric_models import (
    DataPoint,
    Metric,
    MetricAggregation,
    MetricQuery,
    MetricRegistration,
    MetricSeries,
)
from src.repositories.metric_storage_repository import PostgresMetricStorageRepository

logger = logging.getLogger(__name__)


class MetricCollector:
    """
    Metric Collector - 指标采集与存储

    双存储模式：
    - 内存缓存（实时访问）
    - PostgreSQL（持久化，通过 MetricStorageRepository）

    支持：
    - 系统指标（CPU、内存、磁盘、网络、负载）
    - 应用指标（延迟、错误率、吞吐量）
    - 自定义指标注册和记录
    """

    def __init__(self, repository: PostgresMetricStorageRepository):
        if repository is None:
            raise ValueError("PostgresMetricStorageRepository is required for MetricCollector")
        self._repository = repository

        # 注册指标元数据（内存缓存）
        self._registered_metrics: Dict[str, Dict[str, Any]] = {}

        # 原始指标存储: metric_name -> {points: DataPoint[], tags: List[Dict]}
        self._metric_storage: Dict[str, Dict[str, Any]] = {}

        # 指标保留期（毫秒，默认 24 小时）
        self._retention_ms: int = 24 * 60 * 60 * 1000

        # 每个指标最大数据点数
        self._max_data_points: int = 10000

        # NATS 消息计数
        self._nats_message_counts: Dict[str, int] = {}

    # ==================== 系统指标采集 ====================

    def collect_system_metrics(self) -> List[Metric]:
        """采集所有系统指标"""
        now = datetime.now(timezone.utc)
        metrics: List[Metric] = []

        # CPU 使用率
        cpu_usage = self._get_cpu_usage()
        metrics.append(Metric(
            id=self._make_id(), name="system.cpu.usage",
            value=cpu_usage, tags={"host": socket.gethostname()},
            timestamp=now, unit="percent",
        ))

        # 内存使用率
        mem = self._get_memory_usage()
        metrics.append(Metric(
            id=self._make_id(), name="system.memory.usage",
            value=mem["percent"], tags={"host": socket.gethostname()},
            timestamp=now, unit="percent",
        ))
        metrics.append(Metric(
            id=self._make_id(), name="system.memory.used",
            value=float(mem["used"]), tags={"host": socket.gethostname()},
            timestamp=now, unit="bytes",
        ))
        metrics.append(Metric(
            id=self._make_id(), name="system.memory.total",
            value=float(mem["total"]), tags={"host": socket.gethostname()},
            timestamp=now, unit="bytes",
        ))

        # 负载均值
        load_avg = os.getloadavg()
        for i, label in enumerate(["1m", "5m", "15m"]):
            metrics.append(Metric(
                id=self._make_id(), name=f"system.load.{label}",
                value=load_avg[i], tags={"host": socket.gethostname()},
                timestamp=now, unit="load",
            ))

        # 记录所有系统指标
        for m in metrics:
            self.record_metric(m.name, m.value, m.tags, m.timestamp)

        return metrics

    def _get_cpu_usage(self) -> float:
        """获取 CPU 使用率（基于 load average 估算）"""
        load_avg = os.getloadavg()[0]
        try:
            num_cpus = os.cpu_count() or 1
        except Exception:
            num_cpus = 1
        return min(100.0, round((load_avg / num_cpus) * 100, 2))

    @staticmethod
    def _get_memory_usage() -> Dict[str, int]:
        """获取内存使用情况"""
        import psutil
        mem = psutil.virtual_memory()
        return {
            "used": mem.used,
            "total": mem.total,
            "percent": mem.percent,
        }

    @staticmethod
    def _get_disk_usage() -> Dict[str, float]:
        """获取磁盘使用率"""
        import psutil
        disk = psutil.disk_usage("/")
        return {"percent": disk.percent}

    @staticmethod
    def _get_network_stats() -> Dict[str, int]:
        """获取网络 I/O 统计"""
        import psutil
        net = psutil.net_io_counters()
        return {"bytes_recv": net.bytes_recv, "bytes_sent": net.bytes_sent}

    # ==================== 指标注册 ====================

    def register_metric(self, params: MetricRegistration) -> None:
        """注册自定义指标"""
        self._registered_metrics[params.name] = {
            "name": params.name,
            "unit": params.unit,
            "default_tags": params.default_tags or {},
            "description": params.description,
        }

        # 初始化内存缓存
        if params.name not in self._metric_storage:
            self._metric_storage[params.name] = {"points": [], "tags": []}

        # 持久化到 PostgreSQL（fire-and-forget）
        try:
            self._repository.register_metric(params)
        except Exception as e:
            logger.warning(f"[MetricCollector] Failed to register metric in repository: {e}")

    def unregister_metric(self, name: str) -> bool:
        """注销指标"""
        self._registered_metrics.pop(name, None)
        self._metric_storage.pop(name, None)
        try:
            result = self._repository.unregister_metric(name)
            return result
        except Exception as e:
            logger.warning(f"[MetricCollector] Failed to unregister metric: {e}")
            return False

    def get_registered_metrics(self) -> List[str]:
        """获取所有已注册指标名称"""
        return list(self._registered_metrics.keys())

    # ==================== 指标记录 ====================

    def record_metric(
        self,
        name: str,
        value: float,
        tags: Optional[Dict[str, str]] = None,
        timestamp: Optional[datetime] = None,
    ) -> None:
        """记录指标值（双写：内存 + PostgreSQL）"""
        ts = timestamp or datetime.now(timezone.utc)

        # 更新内存缓存
        if name not in self._metric_storage:
            self._metric_storage[name] = {"points": [], "tags": []}

        storage = self._metric_storage[name]
        storage["points"].append(DataPoint(timestamp=ts, value=value))
        storage["tags"].append(tags or {})

        # 强制保留策略
        self._enforce_retention(name)

        # 限制最大数据点数
        if len(storage["points"]) > self._max_data_points:
            excess = len(storage["points"]) - self._max_data_points
            storage["points"] = storage["points"][excess:]
            storage["tags"] = storage["tags"][excess:]

        # 持久化到 PostgreSQL（fire-and-forget）
        try:
            self._repository.insert_data_point(
                tenant_id="default",
                metric_name=name,
                value=value,
                tags=tags or {},
                timestamp=ts,
            )
        except Exception as e:
            logger.debug(f"[MetricCollector] Failed to persist data point: {e}")

    def record_latency(self, endpoint: str, latency_ms: float, status_code: Optional[int] = None) -> None:
        """记录应用延迟"""
        tags: Dict[str, str] = {"endpoint": endpoint}
        if status_code:
            tags["status_code"] = str(status_code)
        self.record_metric("app.http.latency", latency_ms, tags)

    def record_error(self, service_name: str, error_type: Optional[str] = None) -> None:
        """记录错误"""
        tags: Dict[str, str] = {"service": service_name}
        if error_type:
            tags["error_type"] = error_type
        self.record_metric("app.errors.count", 1.0, tags)

    def record_throughput(self, service_name: str, count: float = 1.0) -> None:
        """记录吞吐量"""
        self.record_metric("app.throughput", count, {"service": service_name})

    def record_nats_message_rate(self, subject: str, count: float = 1.0) -> None:
        """记录 NATS 消息速率"""
        self._nats_message_counts[subject] = self._nats_message_counts.get(subject, 0) + int(count)
        self.record_metric("nats.messages", count, {"subject": subject})

    def get_nats_message_counts(self) -> Dict[str, int]:
        """获取 NATS 消息计数"""
        return dict(self._nats_message_counts)

    def reset_nats_message_counts(self) -> None:
        """重置 NATS 消息计数"""
        self._nats_message_counts.clear()

    # ==================== 指标查询 ====================

    def get_metric_series(self, query: MetricQuery) -> MetricSeries:
        """获取指标时间序列（内存缓存）"""
        return self._get_metric_series_from_memory(query)

    async def get_metric_series_async(self, query: MetricQuery, tenant_id: str = "default") -> MetricSeries:
        """异步获取指标时间序列（从 PostgreSQL）"""
        return self._repository.query_metric_series(query, tenant_id)

    def _get_metric_series_from_memory(self, query: MetricQuery) -> MetricSeries:
        """从内存缓存获取指标时间序列"""
        storage = self._metric_storage.get(query.name)
        if not storage or not storage["points"]:
            return self._empty_series(query.name)

        points = list(storage["points"])
        tags_list = list(storage["tags"])

        # 标签过滤
        if query.tags:
            filtered = []
            for i, p in enumerate(points):
                if i < len(tags_list) and self._tags_match(tags_list[i], query.tags):
                    filtered.append(p)
            points = filtered

        # 时间窗口过滤
        if query.start_time:
            points = [p for p in points if p.timestamp >= query.start_time]
        if query.end_time:
            points = [p for p in points if p.timestamp <= query.end_time]

        # 最大点数限制（采样）
        if query.max_points and len(points) > query.max_points:
            step = max(1, len(points) // query.max_points)
            points = points[::step][: query.max_points]

        values = [p.value for p in points]
        aggregation = self._compute_aggregation(values)

        window_start = points[0].timestamp if points else datetime.now(timezone.utc)
        window_end = points[-1].timestamp if points else datetime.now(timezone.utc)

        return MetricSeries(
            name=query.name,
            data_points=points,
            aggregation=aggregation,
            tags=query.tags,
            window_start=window_start,
            window_end=window_end,
        )

    def get_metric_summary(
        self,
        name: str,
        tags: Optional[Dict[str, str]] = None,
        window_ms: Optional[int] = None,
    ) -> MetricAggregation:
        """获取指标聚合摘要（内存缓存）"""
        query = MetricQuery(name=name, tags=tags)
        if window_ms:
            query.start_time = datetime.now(timezone.utc).replace(tzinfo=None)
            from datetime import timedelta
            query.start_time = datetime.now(timezone.utc) - timedelta(milliseconds=window_ms)
            query.end_time = datetime.now(timezone.utc)
        series = self._get_metric_series_from_memory(query)
        return series.aggregation

    async def get_metric_summary_async(
        self,
        name: str,
        tags: Optional[Dict[str, str]] = None,
        window_ms: Optional[int] = None,
        tenant_id: str = "default",
    ) -> MetricAggregation:
        """异步获取指标聚合摘要（从 PostgreSQL）"""
        query = MetricQuery(name=name, tags=tags)
        if window_ms:
            from datetime import timedelta
            query.start_time = datetime.now(timezone.utc) - timedelta(milliseconds=window_ms)
            query.end_time = datetime.now(timezone.utc)
        series = await self._repository.query_metric_series(query, tenant_id)
        return series.aggregation

    def get_latest_value(
        self, name: str, tags: Optional[Dict[str, str]] = None
    ) -> Optional[float]:
        """获取指标最新值（内存缓存）"""
        storage = self._metric_storage.get(name)
        if not storage or not storage["points"]:
            return None

        tags_list = storage.get("tags", [])
        for i in range(len(storage["points"]) - 1, -1, -1):
            if not tags or self._tags_match(tags_list[i], tags):
                return storage["points"][i].value
        return None

    async def get_latest_value_async(
        self, name: str, tags: Optional[Dict[str, str]] = None, tenant_id: str = "default"
    ) -> Optional[float]:
        """异步获取指标最新值（从 PostgreSQL）"""
        return self._repository.get_latest_value(name, tags, tenant_id)

    # ==================== 维护 ====================

    def prune_expired(self) -> int:
        """清理过期的内存数据"""
        cutoff = datetime.now(timezone.utc).timestamp() * 1000 - self._retention_ms
        cutoff_dt = datetime.fromtimestamp(cutoff / 1000, tz=timezone.utc)
        pruned = 0

        for name, storage in self._metric_storage.items():
            points = storage["points"]
            valid_idx = next((i for i, p in enumerate(points) if p.timestamp >= cutoff_dt), len(points))
            if valid_idx > 0:
                pruned += valid_idx
                storage["points"] = points[valid_idx:]
                storage["tags"] = storage["tags"][valid_idx:]
            elif valid_idx == -1 and points:
                pruned += len(points)
                storage["points"] = []
                storage["tags"] = []

        # 清理 PostgreSQL
        try:
            count = self._repository.prune_expired(self._retention_ms, "default")
            logger.info(f"[MetricCollector] Pruned {count} expired points from repository")
        except Exception as e:
            logger.warning(f"[MetricCollector] Failed to prune from repository: {e}")

        return pruned

    def clear_all(self) -> None:
        """清空所有指标数据"""
        self._metric_storage.clear()
        self._registered_metrics.clear()
        self._nats_message_counts.clear()
        try:
            self._repository.clear_all("default")
        except Exception as e:
            logger.warning(f"[MetricCollector] Failed to clear repository: {e}")

    # ==================== Private Helpers ====================

    def _enforce_retention(self, name: str) -> None:
        """强制保留策略"""
        cutoff_ms = datetime.now(timezone.utc).timestamp() * 1000 - self._retention_ms
        cutoff_dt = datetime.fromtimestamp(cutoff_ms / 1000, tz=timezone.utc)
        storage = self._metric_storage.get(name)
        if not storage:
            return

        points = storage["points"]
        valid_idx = next((i for i, p in enumerate(points) if p.timestamp >= cutoff_dt), len(points))
        if valid_idx > 0:
            storage["points"] = points[valid_idx:]
            storage["tags"] = storage["tags"][valid_idx:]

    @staticmethod
    def _tags_match(stored: Dict[str, str], filter_tags: Dict[str, str]) -> bool:
        """检查标签是否匹配过滤条件"""
        for key, value in filter_tags.items():
            if stored.get(key) != value:
                return False
        return True

    @staticmethod
    def _compute_aggregation(values: List[float]) -> MetricAggregation:
        """计算聚合统计"""
        if not values:
            return MetricAggregation()
        sorted_vals = sorted(values)
        total = sum(values)
        count = len(values)
        avg = total / count
        return MetricAggregation(
            avg=round(avg, 2),
            max=sorted_vals[-1],
            min=sorted_vals[0],
            p99=MetricCollector._percentile(sorted_vals, 99),
            p95=MetricCollector._percentile(sorted_vals, 95),
            count=count,
            sum=round(total, 2),
        )

    @staticmethod
    def _percentile(sorted_vals: List[float], p: float) -> float:
        """计算分位值"""
        if not sorted_vals:
            return 0.0
        if len(sorted_vals) == 1:
            return sorted_vals[0]
        index = (p / 100) * (len(sorted_vals) - 1)
        lower = int(index)
        upper = min(lower + 1, len(sorted_vals) - 1)
        if lower == upper:
            return sorted_vals[lower]
        weight = index - lower
        return sorted_vals[lower] * (1 - weight) + sorted_vals[upper] * weight

    def _empty_series(self, name: str) -> MetricSeries:
        """创建空指标序列"""
        now = datetime.now(timezone.utc)
        return MetricSeries(
            name=name,
            data_points=[],
            aggregation=MetricAggregation(),
            window_start=now,
            window_end=now,
        )

    @staticmethod
    def _make_id() -> str:
        """生成指标 ID"""
        import uuid
        return str(uuid.uuid4())
