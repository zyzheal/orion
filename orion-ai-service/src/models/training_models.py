"""
训练数据模型 - 请求/响应模型
"""

from datetime import datetime, timezone
from enum import Enum
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


# ==================== 训练任务 ====================


class TrainingJobStatus(str, Enum):
    """训练任务状态"""

    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class TrainingJobType(str, Enum):
    """训练任务类型"""

    FINE_TUNE = "fine_tune"
    PRE_TRAIN = "pre_train"
    DISTILL = "distill"
    EVALUATE = "evaluate"


class CreateTrainingJobRequest(BaseModel):
    """创建训练任务请求"""

    name: str = Field(..., min_length=1, max_length=200, description="训练任务名称")
    job_type: TrainingJobType = Field(..., description="训练任务类型")
    model_id: str = Field(..., min_length=1, description="基础模型 ID")
    dataset_id: str = Field(..., min_length=1, description="数据集 ID")
    hyperparameters: Optional[Dict[str, Any]] = Field(
        default=None, description="超参数配置"
    )
    description: Optional[str] = Field(
        default=None, max_length=500, description="任务描述"
    )
    tenant_id: Optional[str] = Field(default=None, description="租户 ID")


class TrainingJobResponse(BaseModel):
    """训练任务响应"""

    id: str = Field(..., description="训练任务 ID")
    name: str = Field(..., description="训练任务名称")
    job_type: TrainingJobType = Field(..., description="训练任务类型")
    model_id: str = Field(..., description="基础模型 ID")
    dataset_id: str = Field(..., description="数据集 ID")
    status: TrainingJobStatus = Field(..., description="训练任务状态")
    hyperparameters: Optional[Dict[str, Any]] = Field(
        default=None, description="超参数配置"
    )
    description: Optional[str] = Field(default=None, description="任务描述")
    progress: float = Field(default=0.0, ge=0.0, le=100.0, description="训练进度")
    metrics: Optional[Dict[str, Any]] = Field(
        default=None, description="训练指标（loss/accuracy 等）"
    )
    error_message: Optional[str] = Field(default=None, description="错误信息")
    tenant_id: str = Field(..., description="租户 ID")
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc), description="创建时间"
    )
    updated_at: Optional[datetime] = Field(default=None, description="更新时间")
    completed_at: Optional[datetime] = Field(default=None, description="完成时间")


class CancelTrainingJobRequest(BaseModel):
    """取消训练任务请求"""

    reason: Optional[str] = Field(default=None, max_length=200, description="取消原因")


# ==================== 训练指标 ====================


class TrainingMetric(BaseModel):
    """训练指标"""

    step: int = Field(..., description="训练步数")
    epoch: int = Field(..., description="当前 epoch")
    loss: float = Field(..., description="损失值")
    accuracy: Optional[float] = Field(default=None, description="准确率")
    learning_rate: Optional[float] = Field(default=None, description="学习率")
    timestamp: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc), description="指标时间"
    )


class TrainingMetricSummary(BaseModel):
    """训练指标汇总"""

    job_id: str = Field(..., description="训练任务 ID")
    final_loss: float = Field(..., description="最终损失")
    best_accuracy: Optional[float] = Field(default=None, description="最佳准确率")
    total_steps: int = Field(..., description="总步数")
    total_epochs: int = Field(..., description="总 epoch")
    duration_seconds: float = Field(..., description="训练时长（秒）")
    metrics: List[TrainingMetric] = Field(
        default_factory=list, description="训练指标列表"
    )
