"""
AIGateway 数据模型
"""

from datetime import datetime, timezone
from enum import Enum
from typing import Any, Dict, List, Literal, Optional

from pydantic import BaseModel, Field


# ==================== 枚举类型 ====================


class CircuitState(str, Enum):
    """熔断器状态"""
    CLOSED = "closed"
    OPEN = "open"
    HALF_OPEN = "half_open"


class AIScenario(str, Enum):
    """AI 场景定义"""
    # P0 场景
    AEGIS_RISK_ASSESSMENT = "aegis-risk-assessment"
    AUTO_SCHEDULING = "auto-scheduling"
    ROOT_CAUSE_DIAGNOSIS = "root-cause-diagnosis"
    # P1 场景
    CODE_REVIEW = "code-review"
    TEST_SELECTION = "test-selection"
    CHANGELOG_GENERATION = "changelog-generation"
    INCIDENT_SUMMARY = "incident-summary"
    RUNBOOK_SUGGESTION = "runbook-suggestion"
    METRIC_ANOMALY_DETECTION = "metric-anomaly-detection"
    LOG_PATTERN_ANALYSIS = "log-pattern-analysis"
    DEPENDENCY_ANALYSIS = "dependency-analysis"
    CAPACITY_FORECAST = "capacity-forecast"
    SLA_PREDICTION = "sla-prediction"
    KNOWLEDGE_EXTRACTION = "knowledge-extraction"
    ALERT_CORRELATION = "alert-correlation"
    AUTOMATION_SUGGESTION = "automation-suggestion"


AI_SCENARIO_PRIORITY: Dict[str, Literal["P0", "P1"]] = {
    # P0 场景
    "aegis-risk-assessment": "P0",
    "auto-scheduling": "P0",
    "root-cause-diagnosis": "P0",
    # P1 场景
    "code-review": "P1",
    "test-selection": "P1",
    "changelog-generation": "P1",
    "incident-summary": "P1",
    "runbook-suggestion": "P1",
    "metric-anomaly-detection": "P1",
    "log-pattern-analysis": "P1",
    "dependency-analysis": "P1",
    "capacity-forecast": "P1",
    "sla-prediction": "P1",
    "knowledge-extraction": "P1",
    "alert-correlation": "P1",
    "automation-suggestion": "P1",
}


class DegradationStrategy(str, Enum):
    """降级策略"""
    RULE_ENGINE = "rule-engine"
    TEMPLATE = "template"
    CACHE = "cache"
    MANUAL = "manual"
    DEFAULT = "default"
    PASSTHROUGH = "passthrough"


# ==================== Gateway 配置与指标 ====================


class CircuitBreakerConfig(BaseModel):
    failure_threshold: int = Field(default=5, description="触发熔断的连续失败次数")
    recovery_timeout: int = Field(default=30000, description="熔断恢复超时(ms)")
    half_open_max_calls: int = Field(default=3, description="半开状态最大尝试次数")


class AIGatewayConfig(BaseModel):
    timeout_thresholds: Dict[str, int] = Field(
        default_factory=lambda: {
            "code-review": 2000,
            "default": 5000,
        },
        description="场景 -> 超时阈值(ms)",
    )
    error_rate_threshold: float = Field(default=0.15, description="错误率阈值")
    confidence_threshold: float = Field(default=0.5, description="置信度阈值")
    circuit_breaker: CircuitBreakerConfig = Field(default_factory=CircuitBreakerConfig)
    window_size: int = Field(default=100, description="统计窗口大小(请求数)")


class AIMetrics(BaseModel):
    scenario: str
    total_requests: int = 0
    failed_requests: int = 0
    total_latency: int = 0
    avg_latency: float = 0.0
    p95_latency: float = 0.0
    error_rate: float = 0.0
    last_error: Optional[str] = None
    last_error_time: Optional[datetime] = None


class AIGatewayHealth(BaseModel):
    scenario: str
    circuit_state: CircuitState
    is_healthy: bool
    metrics: AIMetrics
    last_check_time: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    degradation_active: bool = False


# ==================== 请求/响应模型 ====================


class AIRequestOptions(BaseModel):
    timeout: Optional[int] = None
    priority: Literal["high", "medium", "low"] = "medium"
    require_confidence: Optional[float] = None
    fallback_enabled: bool = True
    preferred_provider: Optional[str] = None


class AIRequestContext(BaseModel):
    user_id: Optional[str] = None
    tenant_id: Optional[str] = None
    trace_id: Optional[str] = None


class AIRequest(BaseModel):
    scenario: AIScenario
    input: Dict[str, Any] = Field(default_factory=dict)
    options: Optional[AIRequestOptions] = None
    context: Optional[AIRequestContext] = None


class AIResponse(BaseModel):
    """AI 网关响应（通用类型）"""
    success: bool
    data: Optional[Any] = None
    confidence: Optional[float] = None
    source: Literal["llm", "degraded", "cache", "fallback"] = "fallback"
    degradation_reason: Optional[str] = None
    latency: int = 0
    error: Optional[str] = None


# ==================== 降级模型 ====================


class DegradationConfig(BaseModel):
    strategy: DegradationStrategy
    cache_ttl: Optional[int] = None
    template_name: Optional[str] = None
    default_response: Optional[Any] = None
    notify_on_degradation: bool = True


class DegradationResult(BaseModel):
    success: bool
    data: Optional[Any] = None
    source: DegradationStrategy
    reason: str
    confidence: float = 0.0
    requires_manual_action: bool = False


# ==================== 熔断器模型 ====================


class CircuitBreakerState(BaseModel):
    scenario: str
    state: CircuitState = CircuitState.CLOSED
    failure_count: int = 0
    success_count: int = 0
    last_failure_time: Optional[datetime] = None
    last_state_change_time: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    half_open_attempts: int = 0


# ==================== 事件模型 ====================


class AIGatewayEventType(str, Enum):
    REQUEST = "request"
    RESPONSE = "response"
    DEGRADATION = "degradation"
    CIRCUIT_OPEN = "circuit_open"
    CIRCUIT_CLOSE = "circuit_close"
    CIRCUIT_HALF_OPEN = "circuit_half_open"


class AIGatewayEvent(BaseModel):
    type: AIGatewayEventType
    scenario: AIScenario
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    data: Dict[str, Any] = Field(default_factory=dict)


# ==================== Prompt 安全模型 ====================


class PromptSecurityConfig(BaseModel):
    enabled: bool = True
    risk_threshold_high: int = Field(default=70, description="高风险阈值，超过拒绝请求")
    risk_threshold_medium: int = Field(default=30, description="中风险阈值，超过需要清洗")
    sanitize_on_medium_risk: bool = True
    reject_on_high_risk: bool = True
    log_security_events: bool = True
