"""
训练服务

提供 AI 模型训练任务管理，包括创建、查询、取消训练任务。
"""

import asyncio
import logging
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from src.models.training import TrainingJob, TrainingJobStatus

logger = logging.getLogger(__name__)


class AITrainingService:
    """
    AI 训练服务

    管理模型训练任务的完整生命周期。
    """

    def __init__(self) -> None:
        self._jobs: Dict[str, TrainingJob] = {}

    async def start_training(
        self,
        job_id: str,
        model_type: str,
        dataset: str,
        config: Dict[str, Any],
    ) -> TrainingJob:
        """
        启动训练任务（模拟异步）
        """
        now = datetime.now(timezone.utc)
        job = TrainingJob(
            job_id=job_id,
            model_type=model_type,
            dataset=dataset,
            config=config,
            status=TrainingJobStatus.PENDING,
            progress=0.0,
            started_at=now,
            completed_at=None,
            error=None,
        )
        self._jobs[job_id] = job

        # 后台模拟训练进度
        asyncio.create_task(self._simulate_training(job_id))

        logger.info(
            "Training job started",
            extra={"job_id": job_id, "model_type": model_type, "dataset": dataset},
        )
        return job

    async def get_job_status(self, job_id: str) -> Optional[TrainingJob]:
        """查询训练任务状态"""
        return self._jobs.get(job_id)

    async def cancel_job(self, job_id: str) -> bool:
        """取消训练任务，仅 PENDING/RUNNING 可取消"""
        job = self._jobs.get(job_id)
        if not job:
            return False
        if job.status not in (TrainingJobStatus.PENDING, TrainingJobStatus.RUNNING):
            return False

        job.status = TrainingJobStatus.CANCELLED
        job.completed_at = datetime.now(timezone.utc)
        logger.info("Training job cancelled", extra={"job_id": job_id})
        return True

    async def list_jobs(
        self, status: Optional[str] = None
    ) -> List[TrainingJob]:
        """列出训练任务，支持按状态过滤"""
        jobs = list(self._jobs.values())
        if status:
            try:
                expected = TrainingJobStatus(status)
                jobs = [j for j in jobs if j.status == expected]
            except ValueError:
                pass
        return jobs

    async def _simulate_training(self, job_id: str) -> None:
        """后台模拟训练进度"""
        await asyncio.sleep(0.5)
        job = self._jobs.get(job_id)
        if not job or job.status == TrainingJobStatus.CANCELLED:
            return

        job.status = TrainingJobStatus.RUNNING
        for i in range(1, 11):
            await asyncio.sleep(0.3)
            job = self._jobs.get(job_id)
            if not job or job.status == TrainingJobStatus.CANCELLED:
                return
            job.progress = float(i * 10)

        job = self._jobs.get(job_id)
        if job and job.status != TrainingJobStatus.CANCELLED:
            job.status = TrainingJobStatus.COMPLETED
            job.completed_at = datetime.now(timezone.utc)
            logger.info("Training job completed", extra={"job_id": job_id})


# 全局训练服务实例
training_service = AITrainingService()
