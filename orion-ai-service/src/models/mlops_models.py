"""
MLOps 数据模型 - 请求/响应模型
"""

from datetime import datetime, timezone
from enum import Enum
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


# ==================== 模型部署 ====================


class ModelDeploymentStatus(str, Enum):
    """模型部署状态"""

    PENDING = "pending"
    DEPLOYING = "deploying"
    RUNNING = "running"
    STOPPED = "stopped"
    FAILED = "failed"


class ModelFramework(str, Enum):
    """模型框架"""

    TENSORFLOW = "tensorflow"
    PYTORCH = "pytorch"
    ONNX = "onnx"
    TRITON = "triton"
    CUSTOM = "custom"


class ModelDeployment(BaseModel):
    """模型部署信息"""

    id: str = Field(..., description="部署 ID")
    model_id: str = Field(..., description="模型 ID")
    model_version: str = Field(..., description="模型版本")
    framework: ModelFramework = Field(..., description="模型框架")
    status: ModelDeploymentStatus = Field(..., description="部署状态")
    endpoint_url: Optional[str] = Field(default=None, description="服务端点 URL")
    replicas: int = Field(default=1, description="副本数")
    resources: Optional[Dict[str, Any]] = Field(
        default=None, description="资源配置（CPU/内存/GPU）"
    )
    health_check_url: Optional[str] = Field(
        default=None, description="健康检查端点"
    )
    last_health_check: Optional[datetime] = Field(
        default=None, description="最后健康检查时间"
    )
    is_healthy: bool = Field(default=False, description="健康状态")
    tenant_id: str = Field(..., description="租户 ID")
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc), description="创建时间"
    )
    updated_at: Optional[datetime] = Field(default=None, description="更新时间")


class RegisterModelRequest(BaseModel):
    """注册模型请求"""

    model_id: str = Field(..., min_length=1, description="模型 ID")
    model_name: str = Field(..., min_length=1, max_length=200, description="模型名称")
    model_version: str = Field(..., min_length=1, description="模型版本")
    framework: ModelFramework = Field(..., description="模型框架")
    artifact_path: str = Field(..., min_length=1, description="模型制品路径")
    description: Optional[str] = Field(
        default=None, max_length=500, description="模型描述"
    )
    tags: Optional[List[str]] = Field(default=None, description="模型标签")
    metadata: Optional[Dict[str, Any]] = Field(default=None, description="元数据")
    tenant_id: Optional[str] = Field(default=None, description="租户 ID")


class DeployModelRequest(BaseModel):
    """部署模型请求"""

    model_version: str = Field(..., min_length=1, description="要部署的模型版本")
    replicas: int = Field(default=1, ge=1, le=10, description="副本数")
    resources: Optional[Dict[str, Any]] = Field(
        default=None, description="资源配置"
    )
    endpoint_name: Optional[str] = Field(
        default=None, max_length=100, description="端点名称"
    )


class ModelInfo(BaseModel):
    """模型信息"""

    id: str = Field(..., description="模型 ID")
    name: str = Field(..., description="模型名称")
    latest_version: str = Field(..., description="最新版本")
    framework: ModelFramework = Field(..., description="模型框架")
    description: Optional[str] = Field(default=None, description="模型描述")
    tags: List[str] = Field(default_factory=list, description="模型标签")
    deployment_count: int = Field(default=0, description="部署次数")
    tenant_id: str = Field(..., description="租户 ID")
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc), description="创建时间"
    )
    updated_at: Optional[datetime] = Field(default=None, description="更新时间")


class ModelVersion(BaseModel):
    """模型版本"""

    version: str = Field(..., description="版本号")
    model_id: str = Field(..., description="模型 ID")
    artifact_path: str = Field(..., description="制品路径")
    framework: ModelFramework = Field(..., description="模型框架")
    metrics: Optional[Dict[str, Any]] = Field(
        default=None, description="训练指标（精度/loss 等）"
    )
    metadata: Optional[Dict[str, Any]] = Field(default=None, description="元数据")
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc), description="创建时间"
    )
