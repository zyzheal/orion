"""
AIGateway - AI 服务网关

功能：
1. 健康检查（超时/错误率/置信度）
2. 熔断器模式（CLOSED/OPEN/HALF_OPEN）
3. 指标收集和监控
4. 自动降级触发
5. Prompt 注入检测和清洗
6. 事件处理
"""

import logging
import time
from collections import deque
from datetime import datetime, timezone
from typing import Any, Callable, Dict, List, Optional

from src.models.ai_gateway_models import (
    AIMetrics,
    AIGatewayConfig,
    AIGatewayEvent,
    AIGatewayEventType,
    AIGatewayHealth,
    AIRequest,
    AIResponse,
    AIScenario,
    CircuitBreakerState,
    CircuitState,
    DegradationResult,
    DegradationStrategy,
    PromptSecurityConfig,
)
from src.models.prompt_security_models import PromptAnalysis
from src.services.prompt_security import PromptSecurity

logger = logging.getLogger(__name__)

# 默认网关配置
_DEFAULT_CONFIG = AIGatewayConfig(
    timeout_thresholds={
        "code-review": 2000,
        "default": 5000,
    },
    error_rate_threshold=0.15,
    confidence_threshold=0.5,
    window_size=100,
)

# 默认 Prompt 安全配置
_DEFAULT_PROMPT_SECURITY_CONFIG = PromptSecurityConfig(
    enabled=True,
    risk_threshold_high=70,
    risk_threshold_medium=30,
    sanitize_on_medium_risk=True,
    reject_on_high_risk=True,
    log_security_events=True,
)


class AIGateway:
    """
    AI 网关核心

    管理场景级熔断、指标收集、Prompt 安全和降级路由。
    """

    def __init__(
        self,
        config: Optional[AIGatewayConfig] = None,
        prompt_security_config: Optional[PromptSecurityConfig] = None,
    ):
        self.config = config or _DEFAULT_CONFIG
        self.prompt_security_config = prompt_security_config or _DEFAULT_PROMPT_SECURITY_CONFIG
        self.prompt_security = PromptSecurity(self.prompt_security_config)

        # 每个场景的指标 (in-memory)
        self._metrics: Dict[AIScenario, Dict[str, Any]] = {}
        # 每个场景的熔断器状态
        self._circuit_states: Dict[AIScenario, CircuitBreakerState] = {}
        # 每个场景的请求历史（用于计算 P95）
        self._request_history: Dict[AIScenario, deque] = {}
        # 事件处理器
        self._event_handlers: List[Callable[[AIGatewayEvent], None]] = []
        # LLM 调用函数（外部注入）
        self._llm_caller: Optional[Callable] = None
        # 当前 Provider
        self._current_provider = "default"

        # 初始化所有已知场景
        for scenario in AIScenario:
            self._init_scenario(scenario)

    def _init_scenario(self, scenario: AIScenario) -> None:
        """初始化场景状态"""
        if scenario not in self._metrics:
            self._metrics[scenario] = {
                "total_requests": 0,
                "failed_requests": 0,
                "total_latency": 0,
                "latencies": deque(maxlen=self.config.window_size),
                "last_error": None,
                "last_error_time": None,
            }
        if scenario not in self._circuit_states:
            self._circuit_states[scenario] = CircuitBreakerState(scenario=scenario.value)
        if scenario not in self._request_history:
            self._request_history[scenario] = deque(maxlen=self.config.window_size)

    def set_llm_caller(self, caller: Callable) -> None:
        """设置 LLM 调用函数"""
        self._llm_caller = caller

    def on_event(self, handler: Callable[[AIGatewayEvent], None]) -> None:
        """注册事件处理器"""
        self._event_handlers.append(handler)

    def _emit_event(self, event: AIGatewayEvent) -> None:
        """发送事件"""
        for handler in self._event_handlers:
            try:
                handler(event)
            except Exception as e:
                logger.error("Event handler error", extra={"error": str(e)})

    def get_current_provider(self) -> str:
        """获取当前 Provider"""
        return self._current_provider

    def get_available_providers(self) -> List[str]:
        """获取可用 Provider 列表"""
        return ["default", "openai", "anthropic"]

    def get_circuit_state(self, scenario: AIScenario) -> CircuitBreakerState:
        """获取场景熔断器状态"""
        return self._circuit_states.get(scenario, CircuitBreakerState(scenario=scenario.value))

    def get_circuit_breaker_manager(self) -> Dict[str, Any]:
        """获取熔断器管理器（兼容 TS 接口）"""
        return {
            "states": self._circuit_states,
            "get_health_summary": self._get_health_summary,
        }

    def _get_health_summary(self) -> Dict[str, Any]:
        """熔断器健康摘要"""
        total = len(self._circuit_states)
        open_count = sum(1 for s in self._circuit_states.values() if s.state == CircuitState.OPEN)
        return {
            "total_scenarios": total,
            "open_circuits": open_count,
            "healthy": open_count == 0,
        }

    def get_dual_circuit_health_summary(self) -> Dict[str, Any]:
        """双层熔断健康摘要"""
        return self._get_health_summary()

    async def check_health(self, scenario: AIScenario) -> AIGatewayHealth:
        """检查场景健康状态"""
        self._init_scenario(scenario)
        metrics_data = self._metrics[scenario]
        circuit_state = self._circuit_states[scenario]

        is_healthy = (
            circuit_state.state == CircuitState.CLOSED
            and metrics_data["error_rate"] < self.config.error_rate_threshold
        )

        return AIGatewayHealth(
            scenario=scenario.value,
            circuit_state=circuit_state.state,
            is_healthy=is_healthy,
            metrics=AIMetrics(
                scenario=scenario.value,
                total_requests=metrics_data["total_requests"],
                failed_requests=metrics_data["failed_requests"],
                total_latency=metrics_data["total_latency"],
                avg_latency=metrics_data["avg_latency"],
                p95_latency=self._calc_p95(scenario),
                error_rate=metrics_data["error_rate"],
                last_error=metrics_data["last_error"],
                last_error_time=metrics_data["last_error_time"],
            ),
            degradation_active=circuit_state.state == CircuitState.OPEN,
        )

    async def get_all_health(self) -> List[AIGatewayHealth]:
        """获取所有场景健康状态"""
        results = []
        for scenario in AIScenario:
            results.append(await self.check_health(scenario))
        return results

    def reset_circuit(self, scenario: AIScenario) -> None:
        """重置熔断器"""
        if scenario in self._circuit_states:
            state = self._circuit_states[scenario]
            state.state = CircuitState.CLOSED
            state.failure_count = 0
            state.success_count = 0
            state.half_open_attempts = 0
            state.last_state_change_time = datetime.now(timezone.utc)
            logger.info("Circuit reset", extra={"scenario": scenario.value})

    def trip_circuit(self, scenario: AIScenario) -> None:
        """触发熔断（打开）"""
        if scenario in self._circuit_states:
            state = self._circuit_states[scenario]
            state.state = CircuitState.OPEN
            state.last_failure_time = datetime.now(timezone.utc)
            state.last_state_change_time = datetime.now(timezone.utc)
            self._emit_event(AIGatewayEvent(
                type=AIGatewayEventType.CIRCUIT_OPEN,
                scenario=scenario,
                data={"failure_count": state.failure_count},
            ))
            logger.warning("Circuit tripped", extra={"scenario": scenario.value})

    def update_prompt_security_config(self, config: Dict[str, Any]) -> None:
        """更新 Prompt 安全配置"""
        self.prompt_security_config = PromptSecurityConfig(**config)
        self.prompt_security = PromptSecurity(self.prompt_security_config)

    # ==================== 核心执行逻辑 ====================

    async def execute(self, request: AIRequest) -> AIResponse:
        """
        执行 AI 请求（核心入口）

        流程：熔断检查 → Prompt 安全检测 → LLM 调用 → 指标更新
        """
        scenario = request.scenario
        self._init_scenario(scenario)
        start_time = time.time()

        # 1. 熔断检查
        circuit_state = self._circuit_states[scenario]
        if circuit_state.state == CircuitState.OPEN:
            if self._should_half_open(scenario):
                circuit_state.state = CircuitState.HALF_OPEN
                circuit_state.half_open_attempts = 0
                self._emit_event(AIGatewayEvent(
                    type=AIGatewayEventType.CIRCUIT_HALF_OPEN,
                    scenario=scenario,
                ))
            else:
                logger.warning("Circuit open, degrading", extra={"scenario": scenario.value})
                return self._build_degraded_response(request, "circuit_open", start_time)

        # 2. Prompt 安全检测
        if self.prompt_security_config.enabled:
            input_text = self._extract_input_text(request.input)
            if input_text:
                security_analysis = self.prompt_security.analyze(input_text)
                if not security_analysis.is_safe:
                    if self.prompt_security_config.reject_on_high_risk:
                        logger.warning(
                            "Prompt rejected",
                            extra={"scenario": scenario.value, "risk_score": security_analysis.risk_score},
                        )
                        return AIResponse(
                            success=False,
                            error=f"Security: prompt rejected (risk={security_analysis.risk_score})",
                            source="fallback",
                            latency=int((time.time() - start_time) * 1000),
                        )

        # 3. 调用 LLM
        success = False
        error_msg: Optional[str] = None
        data: Any = None
        confidence: Optional[float] = None

        try:
            if self._llm_caller:
                raw_response = await self._llm_caller(request)
                if isinstance(raw_response, dict):
                    data = raw_response.get("data")
                    confidence = raw_response.get("confidence")
            success = True
        except Exception as e:
            success = False
            error_msg = str(e)
            logger.error(
                "LLM call failed",
                extra={"scenario": scenario.value, "error": error_msg},
            )

        latency_ms = int((time.time() - start_time) * 1000)

        # 4. 更新指标
        self._record_request(scenario, success, latency_ms, error_msg)

        # 5. 熔断器状态更新
        if success:
            self._on_request_success(scenario)
        else:
            self._on_request_failure(scenario, error_msg)

        # 6. 失败时尝试降级
        if not success:
            degradation = self._try_degradation(request, error_msg or "llm_failed")
            if degradation.success:
                return AIResponse(
                    success=True,
                    data=degradation.data,
                    confidence=degradation.confidence,
                    source="degraded",
                    degradation_reason=degradation.reason,
                    latency=latency_ms,
                )

        return AIResponse(
            success=success,
            data=data,
            confidence=confidence,
            source="llm" if success else "fallback",
            error=error_msg,
            latency=latency_ms,
        )

    def _should_half_open(self, scenario: AIScenario) -> bool:
        """检查是否应进入半开状态"""
        state = self._circuit_states.get(scenario)
        if not state or not state.last_failure_time:
            return False
        elapsed = (datetime.now(timezone.utc) - state.last_failure_time).total_seconds() * 1000
        return elapsed > self.config.circuit_breaker.recovery_timeout

    def _extract_input_text(self, input_data: Dict[str, Any]) -> Optional[str]:
        """从请求输入中提取文本用于安全检测"""
        if isinstance(input_data, str):
            return input_data
        if isinstance(input_data, dict):
            for key in ("prompt", "message", "text", "query", "input"):
                if key in input_data and isinstance(input_data[key], str):
                    return input_data[key]
        return None

    def _record_request(
        self, scenario: AIScenario, success: bool, latency_ms: int, error: Optional[str]
    ) -> None:
        """记录请求指标"""
        metrics = self._metrics[scenario]
        metrics["total_requests"] += 1
        metrics["total_latency"] += latency_ms
        metrics["latencies"].append(latency_ms)

        if not success:
            metrics["failed_requests"] += 1
            metrics["last_error"] = error
            metrics["last_error_time"] = datetime.now(timezone.utc)

        total = metrics["total_requests"]
        metrics["avg_latency"] = metrics["total_latency"] / total if total > 0 else 0.0
        metrics["error_rate"] = metrics["failed_requests"] / total if total > 0 else 0.0

        self._request_history[scenario].append({
            "latency": latency_ms,
            "success": success,
            "timestamp": datetime.now(timezone.utc),
        })

    def _on_request_success(self, scenario: AIScenario) -> None:
        """请求成功回调"""
        state = self._circuit_states.get(scenario)
        if not state:
            return

        state.success_count += 1

        if state.state == CircuitState.HALF_OPEN:
            state.half_open_attempts += 1
            if state.half_open_attempts >= self.config.circuit_breaker.half_open_max_calls:
                state.state = CircuitState.CLOSED
                state.failure_count = 0
                state.half_open_attempts = 0
                state.last_state_change_time = datetime.now(timezone.utc)
                self._emit_event(AIGatewayEvent(
                    type=AIGatewayEventType.CIRCUIT_CLOSE,
                    scenario=scenario,
                ))
                logger.info("Circuit closed", extra={"scenario": scenario.value})

    def _on_request_failure(self, scenario: AIScenario, error: Optional[str]) -> None:
        """请求失败回调"""
        state = self._circuit_states.get(scenario)
        if not state:
            return

        state.failure_count += 1
        state.last_failure_time = datetime.now(timezone.utc)

        threshold = self.config.circuit_breaker.failure_threshold
        if state.failure_count >= threshold and state.state == CircuitState.CLOSED:
            self.trip_circuit(scenario)

        if state.state == CircuitState.HALF_OPEN:
            state.state = CircuitState.OPEN
            state.last_failure_time = datetime.now(timezone.utc)
            state.last_state_change_time = datetime.now(timezone.utc)
            self._emit_event(AIGatewayEvent(
                type=AIGatewayEventType.CIRCUIT_OPEN,
                scenario=scenario,
            ))

    def _try_degradation(self, request: AIRequest, reason: str) -> DegradationResult:
        """尝试降级"""
        self._emit_event(AIGatewayEvent(
            type=AIGatewayEventType.DEGRADATION,
            scenario=request.scenario,
            data={"reason": reason},
        ))
        return DegradationResult(
            success=False,
            source=DegradationStrategy.DEFAULT,
            reason=reason,
            confidence=0.0,
        )

    def _build_degraded_response(
        self, request: AIRequest, reason: str, start_time: float
    ) -> AIResponse:
        """构建降级响应"""
        latency = int((time.time() - start_time) * 1000)
        self._emit_event(AIGatewayEvent(
            type=AIGatewayEventType.DEGRADATION,
            scenario=request.scenario,
            data={"reason": reason},
        ))
        return AIResponse(
            success=False,
            source="degraded",
            degradation_reason=reason,
            latency=latency,
            error=f"Service degraded: {reason}",
        )

    def _calc_p95(self, scenario: AIScenario) -> float:
        """计算 P95 延迟"""
        history = self._request_history.get(scenario, deque())
        if not history:
            return 0.0
        latencies = sorted([h["latency"] for h in history])
        idx = int(len(latencies) * 0.95)
        return latencies[min(idx, len(latencies) - 1)] if latencies else 0.0


ai_gateway = AIGateway()
