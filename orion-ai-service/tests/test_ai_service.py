"""
AI 服务测试
"""

import pytest

from src.services.ai_service import AIServicePlaceholder


@pytest.mark.anyio
async def test_ai_service_placeholder_availability():
    """测试占位 AI 服务不可用（无模型端点）"""
    service = AIServicePlaceholder()
    assert service.is_available is False


@pytest.mark.anyio
async def test_ai_service_initialize_without_endpoint():
    """测试无模型端点时初始化"""
    service = AIServicePlaceholder()
    await service.initialize()
    # 应该不抛出异常，但 _initialized 为 False
    assert service._initialized is False


@pytest.mark.anyio
async def test_ai_analyze_pipeline_placeholder():
    """测试占位 Pipeline 分析"""
    service = AIServicePlaceholder()
    result = await service.analyze_pipeline(
        {
            "pipeline_id": "pipe-001",
            "status": "success",
            "duration_ms": 120000,
        }
    )
    assert result["status"] == "placeholder"
    assert "TASK-302" in result["message"]
    assert result["input_summary"]["pipeline_id"] == "pipe-001"


@pytest.mark.anyio
async def test_ai_analyze_code_review_placeholder():
    """测试占位代码审查"""
    service = AIServicePlaceholder()
    results = await service.analyze_code_review(
        diff="@@ -1 +1 @@\n-old\n+new",
        context={"pr_id": "pr-001"},
    )
    assert len(results) == 1
    assert results[0]["type"] == "placeholder"
    assert "TASK-302" in results[0]["message"]
    assert results[0]["context"]["pr_id"] == "pr-001"
