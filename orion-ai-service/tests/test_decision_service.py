"""
Decision Service 测试

测试 ML 决策服务的加权评分、部署预测、事件严重度逻辑。
"""

import pytest

from src.services.decision_service import DecisionService, decision_service


@pytest.fixture
def service():
    """创建 DecisionService 实例。"""
    return DecisionService()


# ═══════════════════════════════════════
#  核心决策 (make_decision)
# ═══════════════════════════════════════


class TestMakeDecision:
    """加权评分决策测试。"""

    def test_decision_returns_structured_response(self, service):
        """make_decision 返回 {success, data, error}。"""
        result = service.make_decision(
            context={"weights": {"reliability": 1.0}},
            options=[{"name": "A", "scores": {"reliability": 0.8}}],
        )
        assert result["success"] is True
        assert result["error"] is None
        assert "data" in result

    def test_decision_selects_best_option(self, service):
        """应选择得分最高的选项。"""
        result = service.make_decision(
            context={"weights": {"reliability": 1.0}},
            options=[
                {"name": "A", "scores": {"reliability": 0.8}},
                {"name": "B", "scores": {"reliability": 0.3}},
                {"name": "C", "scores": {"reliability": 0.5}},
            ],
        )
        assert result["success"] is True
        assert result["data"]["best_option"] == "A"
        assert result["data"]["best_score"] == pytest.approx(0.8, 0.01)

    def test_decision_all_scores_sorted(self, service):
        """所有选项按分数降序排列。"""
        result = service.make_decision(
            context={"weights": {"reliability": 1.0}},
            options=[
                {"name": "X", "scores": {"reliability": 0.2}},
                {"name": "Y", "scores": {"reliability": 0.9}},
            ],
        )
        scores = [s["score"] for s in result["data"]["all_scores"]]
        assert scores == sorted(scores, reverse=True)

    def test_decision_confidence(self, service):
        """置信度应在 [0, 1] 范围内。"""
        result = service.make_decision(
            context={},
            options=[
                {"name": "A", "scores": {"reliability": 0.9}},
                {"name": "B", "scores": {"reliability": 0.1}},
            ],
        )
        assert result["success"] is True
        assert 0 <= result["data"]["confidence"] <= 1

    def test_decision_no_options(self, service):
        """无选项时返回失败。"""
        result = service.make_decision(context={}, options=[])
        assert result["success"] is False
        assert result["error"] is not None

    def test_decision_explanation(self, service):
        """结果包含决策解释。"""
        result = service.make_decision(
            context={},
            options=[{"name": "A", "scores": {"reliability": 0.8}}],
        )
        assert result["success"] is True
        assert isinstance(result["data"]["explanation"], list)
        assert len(result["data"]["explanation"]) > 0

    def test_decision_weights_used(self, service):
        """结果包含使用的权重。"""
        result = service.make_decision(
            context={"weights": {"reliability": 0.5, "cost": 0.5}},
            options=[{"name": "A", "scores": {"reliability": 0.8, "cost": 0.6}}],
        )
        assert result["success"] is True
        assert "weights_used" in result["data"]


# ═══════════════════════════════════════
#  部署成功预测
# ═══════════════════════════════════════


class TestDeploymentPrediction:
    """部署成功预测测试。"""

    def test_prediction_returns_structured_response(self, service):
        """predict_deployment_success 返回 {success, data, error}。"""
        result = service.predict_deployment_success(
            {"error_rate": 0.01, "latency_p99_ms": 200}
        )
        assert result["success"] is True
        assert result["error"] is None

    def test_good_metrics_success(self, service):
        """优秀指标预测为 likely_success。"""
        result = service.predict_deployment_success(
            {
                "error_rate": 0.01,
                "latency_p99_ms": 200,
                "cpu_percent": 30.0,
                "memory_percent": 40.0,
                "test_pass_rate": 0.99,
            }
        )
        assert result["success"] is True
        assert result["data"]["prediction"] == "likely_success"

    def test_bad_metrics_failure(self, service):
        """糟糕指标预测为 likely_failure。"""
        result = service.predict_deployment_success(
            {
                "error_rate": 0.8,
                "latency_p99_ms": 20000,
                "cpu_percent": 99.0,
                "memory_percent": 99.0,
            }
        )
        assert result["success"] is True
        data = result["data"]
        assert data["prediction"] in ("likely_failure", "uncertain")
        assert data["score"] < 0.70

    def test_empty_metrics_uncertain(self, service):
        """空指标返回 uncertain。"""
        result = service.predict_deployment_success({})
        assert result["success"] is True
        assert result["data"]["prediction"] == "uncertain"
        assert result["data"]["risk_factors"]

    def test_prediction_has_recommendation(self, service):
        """结果包含部署建议。"""
        result = service.predict_deployment_success(
            {"error_rate": 0.01, "latency_p99_ms": 200}
        )
        assert "recommendation" in result["data"]

    def test_prediction_risk_factors(self, service):
        """超过阈值的指标反映在 risk_factors 中。"""
        result = service.predict_deployment_success(
            {"error_rate": 0.5, "cpu_percent": 95.0}
        )
        assert result["success"] is True
        factors = result["data"]["risk_factors"]
        assert any("error_rate" in f for f in factors)


# ═══════════════════════════════════════
#  事件严重度预测
# ═══════════════════════════════════════


class TestIncidentSeverity:
    """事件严重度预测测试。"""

    def test_severity_returns_structured_response(self, service):
        """predict_incident_severity 返回 {success, data, error}。"""
        result = service.predict_incident_severity(
            {"affected_users": 10, "error_rate": 0.05}
        )
        assert result["success"] is True
        assert result["error"] is None

    def test_severity_levels(self, service):
        """严重度应为预定义级别之一。"""
        result = service.predict_incident_severity(
            {"affected_users": 1000, "error_rate": 0.6, "service_tier": "critical"}
        )
        assert result["success"] is True
        assert result["data"]["severity"] in (
            "critical",
            "high",
            "medium",
            "low",
        )

    def test_high_impact_critical(self, service):
        """高影响事件预测为 critical。"""
        result = service.predict_incident_severity(
            {
                "affected_users": 5000,
                "error_rate": 0.8,
                "service_tier": "critical",
                "downtime_minutes": 120,
            }
        )
        assert result["success"] is True
        assert result["data"]["severity"] == "critical"

    def test_low_impact_low(self, service):
        """低影响事件预测为 low。"""
        result = service.predict_incident_severity(
            {"affected_users": 0, "error_rate": 0.0, "service_tier": "low"}
        )
        assert result["success"] is True
        assert result["data"]["severity"] == "low"

    def test_severity_has_response_time(self, service):
        """结果包含响应时间（分钟）。"""
        result = service.predict_incident_severity(
            {"affected_users": 100, "error_rate": 0.3}
        )
        assert result["success"] is True
        assert result["data"]["response_minutes"] > 0

    def test_severity_has_recommendations(self, service):
        """结果包含响应建议。"""
        result = service.predict_incident_severity(
            {"affected_users": 100, "error_rate": 0.2}
        )
        assert result["success"] is True
        assert isinstance(result["data"]["recommendations"], list)
        assert len(result["data"]["recommendations"]) > 0

    def test_workaround_reduces_severity(self, service):
        """有临时方案应降低评分。"""
        r1 = service.predict_incident_severity(
            {"affected_users": 100, "error_rate": 0.2}
        )
        r2 = service.predict_incident_severity(
            {"affected_users": 100, "error_rate": 0.2, "has_workaround": True}
        )
        assert r1["success"] and r2["success"]
        assert r2["data"]["score"] < r1["data"]["score"]

    def test_empty_incident_low(self, service):
        """空事件数据返回 low。"""
        result = service.predict_incident_severity({})
        assert result["success"] is True
        assert result["data"]["severity"] == "low"
