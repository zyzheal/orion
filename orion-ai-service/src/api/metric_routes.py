"""
Metric API 路由

提供指标记录、查询、时间序列、聚合统计接口。
"""

import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel, Field

from src.models.metric_models import MetricQuery, MetricRegistration, MetricSeries
from src.services.metric_collector import MetricCollector
from src.repositories.metric_storage_repository import PostgresMetricStorageRepository

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/metrics", tags=["metrics"])

# ==================== 请求/响应模型 ====================


class RecordMetricRequest(BaseModel):
    """记录指标请求"""
    name: str = Field(..., description="指标名称")
    value: float = Field(..., description="指标值")
    tags: Optional[Dict[str, str]] = Field(default=None, description="标签")
    timestamp: Optional[datetime] = Field(default=None, description="时间戳")


class QueryMetricRequest(BaseModel):
    """查询指标请求"""
    name: str = Field(..., description="指标名称")
    tags: Optional[Dict[str, str]] = Field(default=None, description="标签过滤")
    start_time: Optional[datetime] = Field(default=None, description="开始时间")
    end_time: Optional[datetime] = Field(default=None, description="结束时间")
    max_points: Optional[int] = Field(default=None, description="最大数据点数")


class MetricSummaryResponse(BaseModel):
    """指标聚合摘要响应"""
    name: str
    avg: float
    max: float
    min: float
    p95: float
    p99: float
    count: int
    sum: float


# ==================== 全局实例 ====================

_repository: Optional[PostgresMetricStorageRepository] = None
_collector: Optional[MetricCollector] = None


def get_collector() -> MetricCollector:
    """获取或创建 MetricCollector 实例"""
    global _repository, _collector
    if _collector is None:
        _repository = PostgresMetricStorageRepository()
        _collector = MetricCollector(_repository)
    return _collector


# ==================== 路由 ====================


@router.post("/record")
async def record_metric(request: RecordMetricRequest, x_tenant_id: Optional[str] = Header(None)) -> Dict[str, str]:
    """记录一个指标数据点"""
    collector = get_collector()
    collector.record_metric(
        name=request.name,
        value=request.value,
        tags=request.tags or {},
        timestamp=request.timestamp,
    )
    return {"status": "recorded", "metric": request.name}


@router.post("/query")
async def query_metric(request: QueryMetricRequest, x_tenant_id: Optional[str] = Header(None)) -> MetricSeries:
    """查询指标时间序列"""
    collector = get_collector()
    query = MetricQuery(
        name=request.name,
        tags=request.tags,
        start_time=request.start_time,
        end_time=request.end_time,
        max_points=request.max_points,
    )
    return collector.get_metric_series(query)


@router.get("/{name}/series")
async def get_metric_series(
    name: str,
    tags: Optional[str] = None,
    max_points: Optional[int] = None,
    x_tenant_id: Optional[str] = Header(None),
) -> MetricSeries:
    """获取指标时间序列（GET 接口）"""
    collector = get_collector()
    tag_dict: Dict[str, str] = {}
    if tags:
        for pair in tags.split(","):
            if "=" in pair:
                k, v = pair.split("=", 1)
                tag_dict[k.strip()] = v.strip()

    query = MetricQuery(name=name, tags=tag_dict if tag_dict else None, max_points=max_points)
    return collector.get_metric_series(query)


@router.get("/{name}/summary")
async def get_metric_summary(
    name: str,
    window_ms: Optional[int] = None,
    x_tenant_id: Optional[str] = Header(None),
) -> MetricSummaryResponse:
    """获取指标聚合摘要"""
    collector = get_collector()
    aggregation = collector.get_metric_summary(name, window_ms=window_ms)
    return MetricSummaryResponse(
        name=name,
        avg=aggregation.avg,
        max=aggregation.max,
        min=aggregation.min,
        p95=aggregation.p95,
        p99=aggregation.p99,
        count=aggregation.count,
        sum=aggregation.sum,
    )


@router.post("/register")
async def register_metric(request: MetricRegistration, x_tenant_id: Optional[str] = Header(None)) -> Dict[str, str]:
    """注册自定义指标"""
    collector = get_collector()
    tenant_id = x_tenant_id or "default"
    params = MetricRegistration(
        name=request.name,
        unit=request.unit,
        default_tags=request.default_tags,
        description=request.description,
        tenant_id=tenant_id,
    )
    collector.register_metric(params)
    return {"status": "registered", "metric": request.name}


@router.get("/registry")
async def list_registered_metrics(x_tenant_id: Optional[str] = Header(None)) -> Dict[str, List[str]]:
    """列出所有已注册指标"""
    collector = get_collector()
    return {"metrics": collector.get_registered_metrics()}


@router.delete("/{name}")
async def delete_metric(name: str, x_tenant_id: Optional[str] = Header(None)) -> Dict[str, str]:
    """注销指标"""
    collector = get_collector()
    success = collector.unregister_metric(name)
    if not success:
        raise HTTPException(status_code=404, detail=f"Metric '{name}' not found")
    return {"status": "deleted", "metric": name}


@router.post("/prune")
async def prune_expired(x_tenant_id: Optional[str] = Header(None)) -> Dict[str, int]:
    """清理过期指标数据"""
    collector = get_collector()
    pruned = collector.prune_expired()
    return {"pruned": pruned}


@router.post("/system/collect")
async def collect_system_metrics(x_tenant_id: Optional[str] = Header(None)) -> Dict[str, Any]:
    """采集系统指标"""
    collector = get_collector()
    metrics = collector.collect_system_metrics()
    return {
        "collected": len(metrics),
        "metrics": [
            {
                "name": m.name,
                "value": m.value,
                "unit": m.unit,
                "tags": m.tags,
                "timestamp": m.timestamp.isoformat(),
            }
            for m in metrics
        ],
    }
