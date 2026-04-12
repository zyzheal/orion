"""
Pydantic 数据模型 - API 请求/响应模型
"""

from datetime import datetime, timezone
from enum import Enum
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


# ==================== 健康检查 ====================


class HealthStatus(str, Enum):
    """服务健康状态"""

    HEALTHY = "healthy"
    UNHEALTHY = "unhealthy"
    DEGRADED = "degraded"


class HealthCheckResponse(BaseModel):
    """健康检查响应"""

    status: HealthStatus = Field(default=HealthStatus.HEALTHY)
    version: str = Field(default="0.1.0")
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    components: Dict[str, bool] = Field(
        default_factory=dict, description="各组件健康状态"
    )


# ==================== NATS 连接状态 ====================


class NatsConnectionStatus(BaseModel):
    """NATS 连接状态"""

    connected: bool = Field(default=False)
    servers: List[str] = Field(default_factory=list)
    last_connected_at: Optional[datetime] = Field(default=None)
    reconnect_attempts: int = Field(default=0)


# ==================== AI 服务状态 ====================


class AIServiceStatus(BaseModel):
    """AI 服务状态"""

    available: bool = Field(default=False)
    model_endpoint: Optional[str] = Field(default=None)
    note: str = Field(
        default="AI 模型集成在 TASK-302 中实现",
        description="服务状态说明",
    )


# ==================== 事件模型 ====================


class CloudEvent(BaseModel):
    """
    CloudEvents 1.0 格式
    与平台其他服务保持一致
    """

    id: str = Field(..., description="事件唯一标识")
    source: str = Field(..., description="事件来源")
    type: str = Field(..., description="事件类型")
    specversion: str = Field(default="1.0", description="CloudEvents 规范版本")
    datacontenttype: str = Field(default="application/json", description="内容类型")
    time: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), description="事件时间")
    data: Optional[Dict[str, Any]] = Field(default=None, description="事件数据")


class PipelineRunCompletedEvent(BaseModel):
    """Pipeline 运行完成事件数据"""

    pipeline_id: str = Field(..., description="Pipeline ID")
    run_id: str = Field(..., description="运行 ID")
    status: str = Field(..., description="运行状态 (success/failed/cancelled)")
    project_id: str = Field(..., description="项目 ID")
    branch: str = Field(..., description="触发分支")
    commit_sha: str = Field(..., description="提交 SHA")
    duration_ms: int = Field(default=0, description="运行时长 (ms)")
    stages: Optional[List[Dict[str, Any]]] = Field(
        default=None, description="阶段结果"
    )


class CodePROpenedEvent(BaseModel):
    """PR 打开事件数据"""

    pr_id: str = Field(..., description="PR/MR ID")
    source_branch: str = Field(..., description="源分支")
    target_branch: str = Field(..., description="目标分支")
    project_id: str = Field(..., description="项目 ID")
    repo_adapter_id: str = Field(..., description="代码仓库适配器 ID")
    author: str = Field(..., description="作者")
    title: str = Field(default="", description="PR 标题")
    commit_shas: List[str] = Field(default_factory=list, description="涉及提交列表")
    changed_files: Optional[List[str]] = Field(
        default=None, description="变更文件列表"
    )


# ==================== AI 分析结果（预留接口） ====================


class AIAnalysisResult(BaseModel):
    """AI 分析结果（预留，TASK-302 实现）"""

    analysis_id: str = Field(..., description="分析 ID")
    event_type: str = Field(..., description="触发事件类型")
    event_id: str = Field(..., description="触发事件 ID")
    status: str = Field(default="pending", description="分析状态")
    result: Optional[Dict[str, Any]] = Field(default=None, description="分析结果")
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    completed_at: Optional[datetime] = Field(default=None)
