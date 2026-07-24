"""
MLOps 模型部署数据模型

对应 TS: src/services/mlops/types.ts
"""

from datetime import datetime, timezone
from enum import Enum
from typing import Any, Dict, Optional

from pydantic import BaseModel, Field


class DeploymentStatus(str, Enum):
    """模型部署状态"""

    REGISTERED = "registered"
    DEPLOYING = "deploying"
    DEPLOYED = "deployed"
    FAILED = "failed"
    UNDEPLOYED = "undeployed"


class ModelDeployment(BaseModel):
    """模型部署信息"""

    model_id: str = Field(..., description="模型 ID")
    version: str = Field(..., description="模型版本")
    path: str = Field(..., description="模型存储路径")
    environment: str = Field(..., description="部署环境 (如 'dev', 'staging', 'prod')")
    status: DeploymentStatus = Field(default=DeploymentStatus.REGISTERED, description="部署状态")
    deployed_at: Optional[datetime] = Field(default=None, description="部署完成时间")
    metadata: Dict[str, Any] = Field(default_factory=dict, description="额外元数据")
