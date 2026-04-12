"""
Pydantic 数据模型测试
"""

import pytest
from datetime import datetime, timezone

from src.models import (
    CloudEvent,
    HealthCheckResponse,
    HealthStatus,
    PipelineRunCompletedEvent,
    CodePROpenedEvent,
    AIAnalysisResult,
)


class TestHealthCheckResponse:
    """健康检查响应模型测试"""

    def test_default_values(self):
        """测试默认值"""
        response = HealthCheckResponse()
        assert response.status == HealthStatus.HEALTHY
        assert response.version == "0.1.0"
        assert isinstance(response.timestamp, datetime)
        assert response.components == {}

    def test_with_components(self):
        """测试带组件状态"""
        response = HealthCheckResponse(
            status=HealthStatus.DEGRADED,
            components={"nats": True, "ai_model": False},
        )
        assert response.status == HealthStatus.DEGRADED
        assert response.components["nats"] is True
        assert response.components["ai_model"] is False


class TestCloudEvent:
    """CloudEvent 模型测试"""

    def test_minimal_event(self):
        """测试最小 CloudEvent"""
        event = CloudEvent(
            id="evt-001",
            source="orion-pipeline",
            type="pipeline.run.completed",
        )
        assert event.id == "evt-001"
        assert event.source == "orion-pipeline"
        assert event.type == "pipeline.run.completed"
        assert event.specversion == "1.0"
        assert event.datacontenttype == "application/json"

    def test_event_with_data(self):
        """测试带数据的 CloudEvent"""
        event = CloudEvent(
            id="evt-002",
            source="orion-code-repo",
            type="code.pr.opened",
            data={"pr_id": "pr-001", "title": "Test PR"},
        )
        assert event.data["pr_id"] == "pr-001"
        assert event.data["title"] == "Test PR"


class TestPipelineRunCompletedEvent:
    """Pipeline 完成事件模型测试"""

    def test_valid_event(self):
        """测试有效事件数据"""
        event = PipelineRunCompletedEvent(
            pipeline_id="pipe-001",
            run_id="run-001",
            status="success",
            project_id="proj-001",
            branch="main",
            commit_sha="abc123",
            duration_ms=120000,
        )
        assert event.pipeline_id == "pipe-001"
        assert event.status == "success"
        assert event.duration_ms == 120000

    def test_with_stages(self):
        """测试带阶段数据"""
        event = PipelineRunCompletedEvent(
            pipeline_id="pipe-002",
            run_id="run-002",
            status="success",
            project_id="proj-001",
            branch="develop",
            commit_sha="def456",
            stages=[
                {"name": "build", "status": "success"},
                {"name": "test", "status": "success"},
            ],
        )
        assert len(event.stages) == 2
        assert event.stages[0]["name"] == "build"

    def test_missing_required_field(self):
        """测试缺少必填字段"""
        with pytest.raises(Exception):
            PipelineRunCompletedEvent(
                run_id="run-003",
                status="success",
                # missing pipeline_id, project_id, branch, commit_sha
            )


class TestCodePROpenedEvent:
    """PR 打开事件模型测试"""

    def test_valid_event(self):
        """测试有效事件数据"""
        event = CodePROpenedEvent(
            pr_id="pr-001",
            source_branch="feature/test",
            target_branch="main",
            project_id="proj-001",
            repo_adapter_id="gitlab-001",
            author="developer",
            title="Add new feature",
        )
        assert event.pr_id == "pr-001"
        assert event.title == "Add new feature"
        assert event.commit_shas == []

    def test_with_changed_files(self):
        """测试带变更文件"""
        event = CodePROpenedEvent(
            pr_id="pr-002",
            source_branch="hotfix/bug",
            target_branch="main",
            project_id="proj-001",
            repo_adapter_id="gitlab-001",
            author="reviewer",
            changed_files=["src/main.py", "tests/test_main.py"],
        )
        assert len(event.changed_files) == 2


class TestAIAnalysisResult:
    """AI 分析结果模型测试"""

    def test_pending_result(self):
        """测试待处理分析结果"""
        result = AIAnalysisResult(
            analysis_id="analysis-001",
            event_type="code.pr.opened",
            event_id="evt-001",
        )
        assert result.status == "pending"
        assert result.result is None
        assert result.completed_at is None

    def test_completed_result(self):
        """测试已完成分析结果"""
        now = datetime.now(timezone.utc)
        result = AIAnalysisResult(
            analysis_id="analysis-002",
            event_type="pipeline.run.completed",
            event_id="evt-002",
            status="completed",
            result={"issues_found": 3, "summary": "OK"},
            completed_at=now,
        )
        assert result.status == "completed"
        assert result.result["issues_found"] == 3
        assert result.completed_at == now
