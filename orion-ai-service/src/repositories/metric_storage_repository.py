"""
Metric 仓储层

使用 PostgreSQL 持久化 metric_registry 和 metric_data_points。
对应 TS: src/services/monitoring/MetricStorageRepository.ts
"""

import json
import logging
import os
from contextlib import contextmanager
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

import psycopg2
from psycopg2 import pool

from src.models.metric_models import (
    DataPoint,
    MetricAggregation,
    MetricQuery,
    MetricRegistration,
    MetricSeries,
)

logger = logging.getLogger(__name__)

_DEFAULT_DSN = os.environ.get(
    "ORION_AI_DATABASE_URL",
    "postgresql://orion:orion@localhost:5432/orion",
)


# ==================== 仓储接口 ====================


class MetricStorageRepository:
    """Metric 仓储接口"""

    def register_metric(self, params: MetricRegistration) -> None:
        raise NotImplementedError

    def unregister_metric(self, name: str) -> bool:
        raise NotImplementedError

    def get_all_registered_metrics(self) -> List[str]:
        raise NotImplementedError

    def get_metric_registry(self, name: str) -> Optional[Dict[str, Any]]:
        raise NotImplementedError

    def insert_data_point(
        self,
        tenant_id: str,
        metric_name: str,
        value: float,
        tags: Optional[Dict[str, str]] = None,
        timestamp: Optional[datetime] = None,
    ) -> None:
        raise NotImplementedError

    def query_metric_series(self, query: MetricQuery, tenant_id: str) -> MetricSeries:
        raise NotImplementedError

    def get_latest_value(
        self, name: str, tags: Optional[Dict[str, str]], tenant_id: str
    ) -> Optional[float]:
        raise NotImplementedError

    def prune_expired(self, retention_ms: int, tenant_id: str) -> int:
        raise NotImplementedError

    def clear_all(self, tenant_id: str) -> None:
        raise NotImplementedError


# ==================== PostgreSQL 实现 ====================


class PostgresMetricStorageRepository(MetricStorageRepository):
    """PostgreSQL 实现的 Metric 仓储"""

    def __init__(self, dsn: Optional[str] = None, minconn: int = 1, maxconn: int = 5):
        self._dsn = dsn or _DEFAULT_DSN
        self._pool: Optional[pool.SimpleConnectionPool] = None
        self._minconn = minconn
        self._maxconn = maxconn
        self._tables_ensured = False

    def _get_pool(self) -> pool.SimpleConnectionPool:
        if self._pool is None:
            self._pool = pool.SimpleConnectionPool(
                self._minconn, self._maxconn, self._dsn
            )
        return self._pool

    def _ensure_tables_if_needed(self) -> None:
        if self._tables_ensured:
            return
        conn = self._get_pool().getconn()
        try:
            with conn.cursor() as cur:
                statements = [
                    """
                    CREATE TABLE IF NOT EXISTS metric_registry (
                        id VARCHAR(64) PRIMARY KEY,
                        tenant_id TEXT NOT NULL DEFAULT 'default',
                        name VARCHAR(255) NOT NULL,
                        unit VARCHAR(64) NOT NULL,
                        default_tags JSONB DEFAULT '{}',
                        description TEXT,
                        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                        CONSTRAINT unique_metric_name_per_tenant UNIQUE (tenant_id, name)
                    )
                    """,
                    """
                    CREATE TABLE IF NOT EXISTS metric_data_points (
                        id SERIAL PRIMARY KEY,
                        tenant_id TEXT NOT NULL DEFAULT 'default',
                        metric_name VARCHAR(255) NOT NULL,
                        value NUMERIC NOT NULL,
                        tags JSONB DEFAULT '{}',
                        timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
                    )
                    """,
                    "CREATE INDEX IF NOT EXISTS idx_metric_registry_tenant ON metric_registry(tenant_id)",
                    "CREATE INDEX IF NOT EXISTS idx_metric_registry_name ON metric_registry(name)",
                    "CREATE INDEX IF NOT EXISTS idx_metric_registry_tenant_name ON metric_registry(tenant_id, name)",
                    "CREATE INDEX IF NOT EXISTS idx_metric_data_points_tenant_metric ON metric_data_points(tenant_id, metric_name)",
                    "CREATE INDEX IF NOT EXISTS idx_metric_data_points_timestamp ON metric_data_points(timestamp DESC)",
                    "CREATE INDEX IF NOT EXISTS idx_metric_data_points_metric_timestamp ON metric_data_points(metric_name, timestamp DESC)",
                    "CREATE INDEX IF NOT EXISTS idx_metric_data_points_tags ON metric_data_points USING GIN (tags)",
                ]
                for stmt in statements:
                    cur.execute(stmt)
            conn.commit()
            self._tables_ensured = True
        except Exception as e:
            logger.error(f"Failed to ensure metric tables: {e}")
            conn.rollback()
        finally:
            self._get_pool().putconn(conn)

    @contextmanager
    def _get_conn(self):
        conn = self._get_pool().getconn()
        try:
            yield conn
            conn.commit()
        except Exception:
            conn.rollback()
            raise
        finally:
            self._get_pool().putconn(conn)

    # ==================== Registry 操作 ====================

    def register_metric(self, params: MetricRegistration) -> None:
        """注册指标定义"""
        self._ensure_tables_if_needed()
        tenant_id = params.tenant_id or "default"
        metric_id = f"{tenant_id}:{params.name}"
        default_tags = json.dumps(params.default_tags or {})
        description = params.description or ""
        with self._get_conn() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO metric_registry (id, tenant_id, name, unit, default_tags, description)
                    VALUES (%s, %s, %s, %s, %s, %s)
                    ON CONFLICT (tenant_id, name) DO UPDATE SET
                        unit = EXCLUDED.unit,
                        default_tags = EXCLUDED.default_tags,
                        description = EXCLUDED.description,
                        updated_at = NOW()
                    """,
                    (metric_id, tenant_id, params.name, params.unit, default_tags, description),
                )

    def unregister_metric(self, name: str) -> bool:
        """注销指标"""
        self._ensure_tables_if_needed()
        with self._get_conn() as conn:
            with conn.cursor() as cur:
                cur.execute("DELETE FROM metric_registry WHERE name = %s", (name,))
                return cur.rowcount > 0

    def get_all_registered_metrics(self) -> List[str]:
        """获取所有已注册指标名称"""
        self._ensure_tables_if_needed()
        with self._get_conn() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT name FROM metric_registry ORDER BY created_at DESC")
                return [row[0] for row in cur.fetchall()]

    def get_metric_registry(self, name: str) -> Optional[Dict[str, Any]]:
        """获取指标注册信息"""
        self._ensure_tables_if_needed()
        with self._get_conn() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT id, tenant_id, name, unit, default_tags, description, created_at, updated_at FROM metric_registry WHERE name = %s",
                    (name,),
                )
                row = cur.fetchone()
                if row:
                    return {
                        "id": row[0],
                        "tenant_id": row[1],
                        "name": row[2],
                        "unit": row[3],
                        "default_tags": row[4] or {},
                        "description": row[5],
                        "created_at": row[6],
                        "updated_at": row[7],
                    }
                return None

    # ==================== Data Point 操作 ====================

    def insert_data_point(
        self,
        tenant_id: str,
        metric_name: str,
        value: float,
        tags: Optional[Dict[str, str]] = None,
        timestamp: Optional[datetime] = None,
    ) -> None:
        """插入指标数据点"""
        self._ensure_tables_if_needed()
        ts = timestamp or datetime.now(timezone.utc)
        tags_json = json.dumps(tags or {})
        with self._get_conn() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO metric_data_points (tenant_id, metric_name, value, tags, timestamp)
                    VALUES (%s, %s, %s, %s, %s)
                    """,
                    (tenant_id, metric_name, value, tags_json, ts),
                )

    def query_metric_series(self, query: MetricQuery, tenant_id: str) -> MetricSeries:
        """查询指标时间序列"""
        self._ensure_tables_if_needed()
        conditions = ["metric_name = %s"]
        params: list = [query.name]
        param_index = 2

        if query.start_time:
            conditions.append(f"timestamp >= %{param_index}")
            params.append(query.start_time)
            param_index += 1
        if query.end_time:
            conditions.append(f"timestamp <= %{param_index}")
            params.append(query.end_time)
            param_index += 1
        if query.tags and query.tags:
            conditions.append(f"tags @> %{param_index}")
            params.append(json.dumps(query.tags))
            param_index += 1

        where_clause = " AND ".join(conditions)
        with self._get_conn() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    f"""
                    SELECT value, timestamp FROM metric_data_points
                    WHERE {where_clause}
                    ORDER BY timestamp ASC
                    """,
                    params,
                )
                rows = cur.fetchall()

        points = [DataPoint(timestamp=row[1], value=float(row[0])) for row in rows]

        # Apply max points limit (sampling)
        if query.max_points and len(points) > query.max_points:
            step = (len(points) + query.max_points - 1) // query.max_points
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

    def get_latest_value(
        self, name: str, tags: Optional[Dict[str, str]], tenant_id: str
    ) -> Optional[float]:
        """获取指标最新值"""
        self._ensure_tables_if_needed()
        conditions = ["metric_name = %s"]
        params: list = [name]
        param_index = 2

        if tags:
            conditions.append(f"tags @> %{param_index}")
            params.append(json.dumps(tags))
            param_index += 1

        where_clause = " AND ".join(conditions)
        with self._get_conn() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    f"""
                    SELECT value FROM metric_data_points
                    WHERE {where_clause}
                    ORDER BY timestamp DESC
                    LIMIT 1
                    """,
                    params,
                )
                row = cur.fetchone()
                return float(row[0]) if row else None

    def prune_expired(self, retention_ms: int, tenant_id: str) -> int:
        """清理过期的数据点"""
        self._ensure_tables_if_needed()
        cutoff = datetime.now(timezone.utc).timestamp() * 1000 - retention_ms
        cutoff_dt = datetime.fromtimestamp(cutoff / 1000, tz=timezone.utc)
        with self._get_conn() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "DELETE FROM metric_data_points WHERE tenant_id = %s AND timestamp < %s",
                    (tenant_id, cutoff_dt),
                )
                return cur.rowcount or 0

    def clear_all(self, tenant_id: str) -> None:
        """清空租户的所有指标数据"""
        self._ensure_tables_if_needed()
        with self._get_conn() as conn:
            with conn.cursor() as cur:
                cur.execute("DELETE FROM metric_data_points WHERE tenant_id = %s", (tenant_id,))
                cur.execute("DELETE FROM metric_registry WHERE tenant_id = %s", (tenant_id,))

    # ==================== Private Helpers ====================

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
            p99=PostgresMetricStorageRepository._percentile(sorted_vals, 99),
            p95=PostgresMetricStorageRepository._percentile(sorted_vals, 95),
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
