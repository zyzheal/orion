"""
事件处理器测试
"""

import pytest
from unittest.mock import AsyncMock, patch

from src.events.pipeline_handler import handle_pipeline_run_completed
from src.events.code_review_handler import handle_code_pr_opened


@pytest.mark.anyio
async def test_handle_pipeline_run_completed():
    """测试 Pipeline 完成事件处理"""
    event_data = {
        "data": {
            "pipeline_id": "pipe-001",
            "run_id": "run-001",
            "status": "success",
            "project_id": "proj-001",
            "branch": "main",
            "commit_sha": "abc123",
            "duration_ms": 120000,
        }
    }

    # 应该不抛出异常
    await handle_pipeline_run_completed("pipeline.run.completed", event_data)


@pytest.mark.anyio
async def test_handle_pipeline_run_completed_flat_data():
    """测试扁平格式的 Pipeline 事件数据"""
    event_data = {
        "pipeline_id": "pipe-002",
        "run_id": "run-002",
        "status": "failed",
        "project_id": "proj-001",
        "branch": "develop",
        "commit_sha": "def456",
        "duration_ms": 60000,
    }

    await handle_pipeline_run_completed("pipeline.run.completed", event_data)


@pytest.mark.anyio
async def test_handle_pipeline_run_completed_invalid_data():
    """测试无效 Pipeline 事件数据"""
    event_data = {"data": {"invalid": "data"}}

    with pytest.raises(Exception):
        await handle_pipeline_run_completed("pipeline.run.completed", event_data)


@pytest.mark.anyio
async def test_handle_code_pr_opened():
    """测试 PR 打开事件处理"""
    event_data = {
        "data": {
            "pr_id": "pr-001",
            "source_branch": "feature/test",
            "target_branch": "main",
            "project_id": "proj-001",
            "repo_adapter_id": "gitlab-001",
            "author": "developer",
            "title": "Add new feature",
            "commit_shas": ["abc123", "def456"],
            "changed_files": ["src/main.py", "tests/test_main.py"],
        }
    }

    # 应该不抛出异常
    await handle_code_pr_opened("code.pr.opened", event_data)


@pytest.mark.anyio
async def test_handle_code_pr_opened_flat_data():
    """测试扁平格式的 PR 事件数据"""
    event_data = {
        "pr_id": "pr-002",
        "source_branch": "hotfix/bug",
        "target_branch": "main",
        "project_id": "proj-001",
        "repo_adapter_id": "gerrit-001",
        "author": "reviewer",
        "title": "Fix critical bug",
        "commit_shas": ["ghi789"],
    }

    await handle_code_pr_opened("code.pr.opened", event_data)


@pytest.mark.anyio
async def test_handle_code_pr_opened_invalid_data():
    """测试无效 PR 事件数据"""
    event_data = {"data": {"invalid": "data"}}

    with pytest.raises(Exception):
        await handle_code_pr_opened("code.pr.opened", event_data)
