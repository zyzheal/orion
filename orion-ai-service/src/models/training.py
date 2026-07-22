"""
模型训练数据模型

对应 TS: src/services/training/types.ts
"""

from datetime import datetime, timezone
from enum import Enum
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


class TrainingJobStatus(str, Enum):
    """训练任务状态"""

    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class TrainingJob(BaseModel):
    """模型训练任务"""

    job_id: str = Field(..., description="训练任务 ID")
    model_type: str = Field(..., description="模型类型 (如 'llm', 'classifier', 'regressor')")
    dataset: str = Field(..., description="训练数据集名称/路径")
    config: Dict[str, Any] = Field(default_factory=dict, description="训练配置参数")
    status: TrainingJobStatus = Field(default=TrainingJobStatus.PENDING, description="任务状态")
    progress: float = Field(default=0.0, ge=0.0, le=100.0, description="训练进度百分比")
    started_at: Optional[datetime] = Field(default=None, description="开始时间")
    completed_at: Optional[datetime] = Field(default=None, description="完成时间")
    error: Optional[str] = Field(default=None, description="错误信息（失败时设置）")
