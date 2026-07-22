"""
AI 服务测试

测试 AIService 的规则引擎 + 模板匹配降级逻辑。
"""
import json

import pytest

from src.services.ai_service import AIService


@pytest.fixture
def service():
    """创建无模型端点的 AIService 实例（规则引擎降级模式）"""
    return AIService()


@pytest.mark.anyio
async def test_ai_service_rule_based_fallback():
    """测试无模型端点时服务可用（规则引擎降级模式）"""
    service = AIService()
    assert service.is_available is False  # 无模型端点
    await service.initialize()
    assert service._initialized is True  # 规则引擎始终可用


@pytest.mark.anyio
async def test_generate_text_with_template():
    """测试文本生成 - 模板匹配降级"""
    service = AIService()
    response = await service.generate_text(prompt="check disk space usage")

    assert response.id is not None
    assert "df -h" in response.content  # 匹配到 disk 模板
    assert response.model == "rule-based-fallback"
    assert response.tokens_used > 0


@pytest.mark.anyio
async def test_generate_text_no_template():
    """测试文本生成 - 无匹配模板时返回提示"""
    service = AIService()
    response = await service.generate_text(prompt="xyzabc random nonsense")

    assert response.id is not None
    assert "No template found" in response.content


@pytest.mark.anyio
async def test_analyze_pipeline_detects_failures():
    """测试 Pipeline 分析 - 检测失败阶段"""
    service = AIService()
    result = await service.analyze_pipeline({
        "pipeline_id": "pipe-001",
        "status": "failed",
        "duration_ms": 120000,
        "stages": [
            {"name": "build", "status": "success"},
            {"name": "test", "status": "failed"},
        ],
    })

    assert "pipe-001" in result["summary"]
    assert len(result["issues"]) == 1
    assert result["issues"][0]["type"] == "stage_failure"


@pytest.mark.anyio
async def test_analyze_pipeline_healthy():
    """测试 Pipeline 分析 - 健康 pipeline"""
    service = AIService()
    result = await service.analyze_pipeline({
        "pipeline_id": "pipe-002",
        "status": "success",
        "duration_ms": 30000,
        "stages": [
            {"name": "build", "status": "success"},
            {"name": "test", "status": "success"},
        ],
    })

    assert "looks healthy" in result["summary"]
    assert len(result["issues"]) == 0


@pytest.mark.anyio
async def test_diagnose_matches_rule():
    """测试诊断 - 匹配连接拒绝规则"""
    service = AIService()
    response = await service.diagnose(
        symptoms=["connection refused to port 5432"],
    )

    assert response.id is not None
    assert "connection refused" in response.diagnosis.lower()
    assert response.severity.value in ("high", "critical")


@pytest.mark.anyio
async def test_diagnose_no_match():
    """测试诊断 - 无匹配规则"""
    service = AIService()
    response = await service.diagnose(
        symptoms=["something completely unknown"],
    )

    assert response.id is not None
    assert "No specific pattern matched" in response.diagnosis
    assert response.severity == "low"


@pytest.mark.anyio
async def test_review_code_detects_hardcoded_password():
    """测试代码审查 - 检测硬编码密码"""
    service = AIService()
    response = await service.review_code(
        code="password = 'secret123'",
        language="python",
    )

    assert response.id is not None
    assert response.score < 100
    assert any("password" in c.content.lower() for c in response.comments)
    assert response.status.value == "changes_requested"


@pytest.mark.anyio
async def test_review_code_clean():
    """测试代码审查 - 干净代码"""
    service = AIService()
    response = await service.review_code(
        code="def hello():\n    return 'world'",
        language="python",
    )

    assert response.id is not None
    assert response.score >= 80
    assert response.status.value == "approved"


@pytest.mark.anyio
async def test_make_decision_high_risk():
    """测试决策 - 高风险场景推荐保守方案"""
    service = AIService()
    response = await service.make_decision(
        title="Production outage rollback",
        description="Critical production issue",
        options=["gradual rollout", "full rollback", "monitor"],
    )

    assert response.id is not None
    assert response.status == "pending"
    assert response.recommendation in ["gradual rollout", "full rollback", "monitor"]


@pytest.mark.anyio
async def test_analyze_unified_entry():
    """测试统一分析入口 - pipeline 类型"""
    service = AIService()
    response = await service.analyze(
        analysis_type="pipeline",
        data={"pipeline_id": "p1", "status": "success", "stages": []},
    )

    assert response.id is not None
    assert response.type == "pipeline"
    assert response.confidence > 0
