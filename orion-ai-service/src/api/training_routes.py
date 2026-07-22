"""
Training API 路由

提供 AI 模型训练任务管理接口。
"""

import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from src.services.training import training_service
from src.models.training import TrainingJob, TrainingJobStatus

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/ai/training", tags=["ai-training"])


# ==================== 请求/响应模型 ====================


class StartTrainingRequest(BaseModel):
    """启动训练任务请求"""
    job_id: str = Field(..., description="训练任务 ID")
    model_type: str = Field(..., description="模型类型")
    dataset: str = Field(..., description="数据集路径/名称")
    config: Optional[Dict[str, Any]] = Field(default=None, description="训练配置")


class TrainingJobResponse(BaseModel):
    """训练任务响应"""
    job_id: str
    model_type: str
    dataset: str
    config: Dict[str, Any]
    status: str
    progress: float
    started_at: Optional[str]
    completed_at: Optional[str]
    error: Optional[str]


def _to_response(job: TrainingJob) -> TrainingJobResponse:
    """Convert TrainingJob to response model"""
    return TrainingJobResponse(
        job_id=job.job_id,
        model_type=job.model_type,
        dataset=job.dataset,
        config=job.config,
        status=job.status.value,
        progress=job.progress,
        started_at=job.started_at.isoformat() if job.started_at else None,
        completed_at=job.completed_at.isoformat() if job.completed_at else None,
        error=job.error,
    )


# ==================== 路由 ====================


@router.post("/jobs", response_model=TrainingJobResponse)
async def start_training(request: StartTrainingRequest) -> TrainingJobResponse:
    """启动训练任务"""
    job = await training_service.start_training(
        job_id=request.job_id,
        model_type=request.model_type,
        dataset=request.dataset,
        config=request.config or {},
    )
    return _to_response(job)


@router.get("/jobs/{job_id}", response_model=TrainingJobResponse)
async def get_training_job(job_id: str) -> TrainingJobResponse:
    """查询训练任务状态"""
    job = await training_service.get_job_status(job_id)
    if not job:
        raise HTTPException(status_code=404, detail=f"Training job '{job_id}' not found")
    return _to_response(job)


@router.delete("/jobs/{job_id}", response_model=Dict[str, str])
async def cancel_training_job(job_id: str) -> Dict[str, str]:
    """取消训练任务"""
    cancelled = await training_service.cancel_job(job_id)
    if not cancelled:
        raise HTTPException(
            status_code=400,
            detail=f"Training job '{job_id}' cannot be cancelled (not found or already completed)",
        )
    return {"status": "cancelled", "job_id": job_id}


@router.get("/jobs", response_model=List[TrainingJobResponse])
async def list_training_jobs(status: Optional[str] = None) -> List[TrainingJobResponse]:
    """列出训练任务，支持按状态过滤"""
    jobs = await training_service.list_jobs(status=status)
    return [_to_response(j) for j in jobs]
