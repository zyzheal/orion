"""
AITrainingService 测试

测试训练任务的创建、查询、取消和列表功能。
"""

import asyncio

import pytest

from src.services.training import AITrainingService
from src.models.training import TrainingJob, TrainingJobStatus


@pytest.fixture
def service():
    """创建 AITrainingService 实例"""
    return AITrainingService()


class TestStartTraining:
    """启动训练任务测试"""

    @pytest.mark.anyio
    async def test_start_training_returns_job(self, service: AITrainingService):
        """测试启动训练任务返回 TrainingJob"""
        job = await service.start_training(
            job_id="job-001",
            model_type="llm",
            dataset="dataset-v1",
            config={"epochs": 10, "batch_size": 32},
        )

        assert isinstance(job, TrainingJob)
        assert job.job_id == "job-001"
        assert job.model_type == "llm"
        assert job.dataset == "dataset-v1"
        assert job.status == TrainingJobStatus.PENDING
        assert job.progress == 0.0
        assert job.started_at is not None
        assert job.completed_at is None
        assert job.error is None

    @pytest.mark.anyio
    async def test_start_training_stores_job(self, service: AITrainingService):
        """测试启动训练任务后可通过 get_job_status 查询"""
        await service.start_training(
            job_id="job-002",
            model_type="classifier",
            dataset="dataset-v2",
            config={},
        )

        retrieved = await service.get_job_status("job-002")
        assert retrieved is not None
        assert retrieved.job_id == "job-002"
        assert retrieved.model_type == "classifier"

    @pytest.mark.anyio
    async def test_start_training_starts_background_simulation(
        self, service: AITrainingService
    ):
        """测试启动训练后进度会在后台模拟增长"""
        await service.start_training(
            job_id="job-003",
            model_type="regressor",
            dataset="dataset-v3",
            config={},
        )

        # 等待一段时间让模拟训练推进
        await asyncio.sleep(1.5)

        job = await service.get_job_status("job-003")
        assert job is not None
        # 训练应该已经完成或仍在进行
        assert job.progress > 0 or job.status in (
            TrainingJobStatus.COMPLETED,
            TrainingJobStatus.RUNNING,
        )


class TestGetJobStatus:
    """查询训练任务状态测试"""

    @pytest.mark.anyio
    async def test_get_existing_job(self, service: AITrainingService):
        """测试查询已存在的任务"""
        await service.start_training(
            job_id="job-004",
            model_type="llm",
            dataset="ds",
            config={},
        )
        job = await service.get_job_status("job-004")
        assert job is not None
        assert job.job_id == "job-004"

    @pytest.mark.anyio
    async def test_get_nonexistent_job_returns_none(self, service: AITrainingService):
        """测试查询不存在的任务返回 None"""
        job = await service.get_job_status("nonexistent-job")
        assert job is None


class TestCancelJob:
    """取消训练任务测试"""

    @pytest.mark.anyio
    async def test_cancel_pending_job(self, service: AITrainingService):
        """测试取消 pending 状态的任务"""
        await service.start_training(
            job_id="job-005",
            model_type="llm",
            dataset="ds",
            config={},
        )
        result = await service.cancel_job("job-005")
        assert result is True

        job = await service.get_job_status("job-005")
        assert job.status == TrainingJobStatus.CANCELLED
        assert job.completed_at is not None

    @pytest.mark.anyio
    async def test_cancel_nonexistent_job_returns_false(
        self, service: AITrainingService
    ):
        """测试取消不存在的任务返回 False"""
        result = await service.cancel_job("nonexistent-job")
        assert result is False

    @pytest.mark.anyio
    async def test_cancel_completed_job_returns_false(
        self, service: AITrainingService
    ):
        """测试取消已完成的任务返回 False"""
        await service.start_training(
            job_id="job-006",
            model_type="llm",
            dataset="ds",
            config={},
        )
        # 等待训练完成
        await asyncio.sleep(4)

        result = await service.cancel_job("job-006")
        assert result is False

        job = await service.get_job_status("job-006")
        assert job.status == TrainingJobStatus.COMPLETED


class TestListJobs:
    """列出训练任务测试"""

    @pytest.mark.anyio
    async def test_list_all_jobs(self, service: AITrainingService):
        """测试列出所有任务"""
        await service.start_training("job-007", "llm", "ds1", {})
        await service.start_training("job-008", "classifier", "ds2", {})

        jobs = await service.list_jobs()
        assert len(jobs) == 2
        job_ids = {j.job_id for j in jobs}
        assert "job-007" in job_ids
        assert "job-008" in job_ids

    @pytest.mark.anyio
    async def test_list_jobs_empty(self, service: AITrainingService):
        """测试空列表"""
        jobs = await service.list_jobs()
        assert jobs == []

    @pytest.mark.anyio
    async def test_list_jobs_filter_by_status(self, service: AITrainingService):
        """测试按状态过滤任务"""
        await service.start_training("job-009", "llm", "ds", {})
        await service.start_training("job-010", "llm", "ds", {})
        await asyncio.sleep(4)  # 等待任务完成

        pending_jobs = await service.list_jobs(status="pending")
        for job in pending_jobs:
            assert job.status == TrainingJobStatus.PENDING

        completed_jobs = await service.list_jobs(status="completed")
        for job in completed_jobs:
            assert job.status == TrainingJobStatus.COMPLETED

    @pytest.mark.anyio
    async def test_list_jobs_invalid_status_returns_all(
        self, service: AITrainingService
    ):
        """测试无效状态过滤返回全部任务"""
        await service.start_training("job-011", "llm", "ds", {})

        jobs = await service.list_jobs(status="invalid_status")
        assert len(jobs) == 1
