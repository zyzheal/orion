"""
Metric 数据模型

对应 TS: src/services/monitoring/types.ts
"""

from datetime import datetime, timezone
from enum import Enum
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


# ==================== 指标类型 ====================


class Metric(BaseModel):
    """单个指标数据点"""

    id: str = Field(..., description="指标唯一 ID")
    name: str = Field(..., description="指标名称 (如 'cpu.usage', 'http.latency.p99')")
    value: float = Field(..., description="指标值")
    tags: Dict[str, str] = Field(default_factory=dict, description="标签（用于过滤/分组）")
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), description="记录时间")
    unit: str = Field(..., description="单位 (如 'percent', 'ms', 'bytes', 'count')")


class DataPoint(BaseModel):
    """时间序列数据点"""

    timestamp: datetime = Field(..., description="时间戳")
    value: float = Field(..., description="值")


class MetricAggregation(BaseModel):
    """时间序列聚合统计"""

    avg: float = Field(default=0.0, description="平均值")
    max: float = Field(default=0.0, description="最大值")
    min: float = Field(default=0.0, description="最小值")
    p99: float = Field(default=0.0, description="99 分位值")
    p95: float = Field(default=0.0, description="95 分位值")
    count: int = Field(default=0, description="数据点总数")
    sum: float = Field(default=0.0, description="总和")


class MetricSeries(BaseModel):
    """时间序列指标（含聚合统计）"""

    name: str = Field(..., description="指标名称")
    data_points: List[DataPoint] = Field(default_factory=list, description="原始数据点")
    aggregation: MetricAggregation = Field(default_factory=MetricAggregation, description="聚合统计")
    tags: Optional[Dict[str, str]] = Field(default=None, description="标签过滤条件")
    window_start: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), description="窗口起始时间")
    window_end: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), description="窗口结束时间")


class MetricRegistration(BaseModel):
    """自定义指标注册参数"""

    name: str = Field(..., description="指标名称")
    unit: str = Field(..., description="单位")
    default_tags: Dict[str, str] = Field(default_factory=dict, description="默认标签")
    description: Optional[str] = Field(default=None, description="描述")
    tenant_id: Optional[str] = Field(default=None, description="租户 ID")


class MetricQuery(BaseModel):
    """指标时间序列查询参数"""

    name: str = Field(..., description="指标名称")
    tags: Optional[Dict[str, str]] = Field(default=None, description="标签过滤")
    start_time: Optional[datetime] = Field(default=None, description="时间窗口起始")
    end_time: Optional[datetime] = Field(default=None, description="时间窗口结束")
    max_points: Optional[int] = Field(default=None, description="最大数据点数")
