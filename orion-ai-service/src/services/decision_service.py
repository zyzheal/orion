"""
ML 决策服务 (Decision Service)

提供 ML/规则驱动的决策能力：
- make_decision: 多选项加权评分决策
- predict_deployment_success: 基于指标的部署成功预测
- predict_incident_severity: 事件严重度与响应建议
"""

import logging
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)


class DecisionService:
    """
    ML/规则决策服务。

    - 基于上下文加权 + 规则引擎评分。
    - 不依赖 torch（决策以规则为主，可后续接入 ML 模型）。
    """

    # ── 默认特征权重 ──
    _DEFAULT_WEIGHTS = {
        "reliability": 0.30,
        "performance": 0.20,
        "cost": 0.15,
        "risk": 0.15,
        "scalability": 0.10,
        "compatibility": 0.10,
    }

    # ── 部署成功评分规则 ──
    _DEPLOY_RULES = {
        "error_rate": {"threshold": 0.05, "weight": 0.30},
        "latency_p99_ms": {"threshold": 5000, "weight": 0.20},
        "cpu_percent": {"threshold": 85.0, "weight": 0.15},
        "memory_percent": {"threshold": 90.0, "weight": 0.15},
        "test_pass_rate": {"threshold": 0.90, "weight": 0.10, "inverted": False},
        "build_duration_s": {"threshold": 600, "weight": 0.05},
        "change_lines": {"threshold": 500, "weight": 0.05},
    }

    # ── 事件严重度映射 ──
    _SEVERITY_THRESHOLDS = {
        "critical": {"score_min": 80, "response_minutes": 15, "color": "#f5222d"},
        "high": {"score_min": 60, "response_minutes": 30, "color": "#fa8c16"},
        "medium": {"score_min": 40, "response_minutes": 120, "color": "#faad14"},
        "low": {"score_min": 0, "response_minutes": 1440, "color": "#52c41a"},
    }

    def __init__(self) -> None:
        self._torch_available: bool = False
        try:
            import torch  # noqa: F401
            self._torch_available = True
            logger.info("torch available for decision service")
        except ImportError:
            logger.debug("torch not available; using rule-based decisions")

    # ── 核心决策 ──

    def make_decision(
        self, context: Dict[str, Any], options: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """
        多选项 ML/规则决策。

        每个 option 预期包含 {name, scores: {feature: float}}。
        根据权重加权求和，返回最佳选项。
        """
        result_id = str(uuid.uuid4())[:8]
        try:
            weights = context.get("weights", self._DEFAULT_WEIGHTS)
            scores = context.get("scores", {})

            if not options:
                return {
                    "success": False,
                    "data": {"id": result_id},
                    "error": "No options provided",
                }

            scored = []
            for opt in options:
                name = opt.get("name", opt.get("id", "unknown"))
                opt_scores = opt.get("scores", {})
                # 加权求和
                total = 0.0
                used_weight = 0.0
                for feat, w in weights.items():
                    val = opt_scores.get(feat, 0.0)
                    if isinstance(val, (int, float)):
                        total += val * w
                        used_weight += w

                if used_weight > 0:
                    normalized = total / used_weight
                else:
                    normalized = 0.0

                scored.append({
                    "name": name,
                    "score": round(normalized, 4),
                    "details": opt_scores,
                    "attributes": {
                        k: v for k, v in opt.items()
                        if k not in ("name", "id", "scores")
                    },
                })

            scored.sort(key=lambda x: x["score"], reverse=True)
            best = scored[0]

            # 置信度 = 最佳与次佳差距归一化
            if len(scored) > 1:
                gap = best["score"] - scored[1]["score"]
                confidence = min(1.0, 0.5 + gap / 2)
            else:
                confidence = 0.6  # 单一选项，低置信

            explanation = self._build_explanation(
                best["name"], scored, weights, scores
            )

            return {
                "success": True,
                "data": {
                    "id": result_id,
                    "best_option": best["name"],
                    "best_score": best["score"],
                    "confidence": round(confidence, 4),
                    "recommendation": best["name"],
                    "all_scores": scored,
                    "weights_used": weights,
                    "engine": "rule-weighted" if not self._torch_available else "hybrid",
                    "explanation": explanation,
                    "created_at": datetime.now(timezone.utc).isoformat(),
                },
                "error": None,
            }
        except Exception as exc:
            logger.exception("Decision making failed")
            return {
                "success": False,
                "data": {"id": result_id},
                "error": f"Decision making failed: {str(exc)}",
            }

    def _build_explanation(
        self,
        best_name: str,
        scored: List[Dict],
        weights: Dict[str, float],
        scores: Dict[str, Any],
    ) -> List[str]:
        """构建决策解释文本。"""
        parts = [f"Selected '{best_name}' as the recommended option."]
        # 权重最高的特征
        top_feats = sorted(weights.items(), key=lambda x: x[1], reverse=True)[:3]
        parts.append(
            "Top influencing factors: "
            + ", ".join(f"{f}(w={w:.2f})" for f, w in top_feats)
        )
        if len(scored) > 1:
            gap = scored[0]["score"] - scored[1]["score"]
            parts.append(f"Score margin over 2nd place: {gap:.4f}")
        return parts

    # ── 部署成功预测 ──

    def predict_deployment_success(
        self, app_metrics: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        基于应用指标预测部署是否可能成功。

        规则：每个指标超过阈值扣分，综合评分判断。
        评分 >= 0.70 → likely_success
        评分 0.40-0.70 → uncertain
        评分 < 0.40 → likely_failure
        """
        result_id = str(uuid.uuid4())[:8]
        try:
            if not app_metrics:
                return {
                    "success": True,
                    "data": {
                        "id": result_id,
                        "prediction": "uncertain",
                        "score": 0.50,
                        "confidence": 0.3,
                        "risk_factors": ["No metrics provided"],
                        "engine": "rule-based",
                    },
                    "error": None,
                }

            total_score = 0.0
            total_weight = 0.0
            risk_factors: List[str] = []

            for metric_name, rule in self._DEPLOY_RULES.items():
                value = app_metrics.get(metric_name)
                if value is None:
                    # 无数据，按中等风险处理
                    total_score += 0.5 * rule["weight"]
                    total_weight += rule["weight"]
                    risk_factors.append(f"Missing metric: {metric_name}")
                    continue

                try:
                    value = float(value)
                except (TypeError, ValueError):
                    risk_factors.append(f"Invalid metric value: {metric_name}={value}")
                    total_score += 0.3 * rule["weight"]
                    total_weight += rule["weight"]
                    continue

                threshold = rule["threshold"]
                if value <= threshold:
                    # 正常范围 → 高分
                    ratio = value / threshold if threshold != 0 else 1.0
                    metric_score = 1.0 - (ratio * 0.3)  # 越接近阈值分数越低
                else:
                    # 超出阈值 → 扣分
                    ratio = threshold / value if value != 0 else 0.0
                    metric_score = ratio * 0.7
                    risk_factors.append(
                        f"{metric_name}={value} exceeds threshold {threshold}"
                    )

                total_score += metric_score * rule["weight"]
                total_weight += rule["weight"]

            if total_weight > 0:
                normalized = total_score / total_weight
            else:
                normalized = 0.50

            # 判断等级
            if normalized >= 0.70:
                prediction = "likely_success"
                confidence = min(1.0, normalized)
            elif normalized >= 0.40:
                prediction = "uncertain"
                confidence = 0.5 + (normalized - 0.40) * 1.0
            else:
                prediction = "likely_failure"
                confidence = max(0.1, 1.0 - normalized)

            return {
                "success": True,
                "data": {
                    "id": result_id,
                    "prediction": prediction,
                    "score": round(normalized, 4),
                    "confidence": round(confidence, 4),
                    "risk_factors": risk_factors,
                    "metrics_evaluated": len(
                        [m for m in app_metrics if m in self._DEPLOY_RULES]
                    ),
                    "threshold_score_success": 0.70,
                    "threshold_score_failure": 0.40,
                    "engine": "rule-based",
                    "recommendation": (
                        "Proceed with deployment"
                        if prediction == "likely_success"
                        else "Review risk factors before deploying"
                        if prediction == "uncertain"
                        else "Block deployment — address risk factors first"
                    ),
                },
                "error": None,
            }
        except Exception as exc:
            logger.exception("Deployment prediction failed")
            return {
                "success": False,
                "data": {"id": result_id},
                "error": f"Deployment prediction failed: {str(exc)}",
            }

    # ── 事件严重度预测 ──

    def predict_incident_severity(
        self, incident_data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        预测事件严重度并推荐响应方案。

        评分因子：
        - affected_users (影响用户数)
        - error_rate (错误率)
        - service_tier (服务等级: critical/high/medium/low)
        - downtime_minutes (停机分钟数)
        - has_workaround (有无临时方案)
        """
        result_id = str(uuid.uuid4())[:8]
        try:
            if not incident_data:
                return {
                    "success": True,
                    "data": {
                        "id": result_id,
                        "severity": "low",
                        "score": 10,
                        "response_minutes": 1440,
                        "engine": "rule-based",
                    },
                    "error": None,
                }

            score = 0

            # 影响用户数 (0-25)
            affected = incident_data.get("affected_users", 0)
            try:
                affected = int(affected)
            except (TypeError, ValueError):
                affected = 0
            if affected >= 1000:
                score += 25
            elif affected >= 100:
                score += 18
            elif affected >= 10:
                score += 10
            elif affected > 0:
                score += 5

            # 错误率 (0-20)
            error_rate = incident_data.get("error_rate", 0.0)
            try:
                error_rate = float(error_rate)
            except (TypeError, ValueError):
                error_rate = 0.0
            if error_rate >= 0.50:
                score += 20
            elif error_rate >= 0.20:
                score += 15
            elif error_rate >= 0.05:
                score += 10
            elif error_rate > 0:
                score += 5

            # 服务等级 (0-20)
            tier = incident_data.get("service_tier", "medium")
            tier_map = {"critical": 20, "high": 15, "medium": 10, "low": 5}
            score += tier_map.get(tier, 10)

            # 停机时长 (0-15)
            downtime = incident_data.get("downtime_minutes", 0)
            try:
                downtime = int(downtime)
            except (TypeError, ValueError):
                downtime = 0
            if downtime >= 60:
                score += 15
            elif downtime >= 30:
                score += 10
            elif downtime >= 10:
                score += 6
            elif downtime > 0:
                score += 3

            # 有无临时方案 (-10)
            if incident_data.get("has_workaround", False):
                score -= 10

            score = max(0, min(100, score))

            # 确定严重度
            severity = "low"
            response_minutes = 1440
            color = "#52c41a"
            for sev, cfg in self._SEVERITY_THRESHOLDS.items():
                if score >= cfg["score_min"]:
                    severity = sev
                    response_minutes = cfg["response_minutes"]
                    color = cfg["color"]
                    break

            # 推荐响应
            recommendations = self._incident_recommendations(severity, incident_data)

            return {
                "success": True,
                "data": {
                    "id": result_id,
                    "severity": severity,
                    "score": score,
                    "response_minutes": response_minutes,
                    "response_color": color,
                    "recommendations": recommendations,
                    "engine": "rule-based",
                    "created_at": datetime.now(timezone.utc).isoformat(),
                },
                "error": None,
            }
        except Exception as exc:
            logger.exception("Incident severity prediction failed")
            return {
                "success": False,
                "data": {"id": result_id},
                "error": f"Incident severity prediction failed: {str(exc)}",
            }

    def _incident_recommendations(
        self, severity: str, data: Dict[str, Any]
    ) -> List[str]:
        """根据严重度生成响应建议。"""
        recs = []
        tier = data.get("service_tier", "medium")

        if severity == "critical":
            recs = [
                "Page on-call engineer immediately",
                "Activate incident bridge / war room",
                "Notify stakeholders within 5 minutes",
                "Rollback if deployment-related",
            ]
        elif severity == "high":
            recs = [
                "Notify on-call within 15 minutes",
                "Create incident ticket with P1 priority",
                "Assess blast radius and affected services",
            ]
        elif severity == "medium":
            recs = [
                "Create ticket with P2 priority",
                "Assign to team within current business hours",
                "Monitor for escalation",
            ]
        else:
            recs = [
                "Log for next sprint triage",
                "Monitor error trends",
            ]

        if data.get("has_workaround"):
            recs.append("Apply documented workaround to restore service")
        if tier == "critical":
            recs.insert(0, "CRITICAL service — prioritize above all else")

        return recs


# 全局服务实例
decision_service = DecisionService()
