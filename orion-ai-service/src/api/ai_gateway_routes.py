"""
AI Gateway 路由

提供 AI 内容生成、诊断、模型列表和健康检查端点。
通过 AIGateway、AIGenerateService 和 PromptSecurity 实现。
"""

import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Header, HTTPException

from src.models.ai_gateway_models import (
    AIGatewayHealth,
    AIScenario,
    AIRequest,
    AIRequestOptions,
    AIRequestContext,
    AIResponse,
)
from src.models.prompt_security_models import PromptAnalysis
from src.services.ai_gateway import ai_gateway
from src.services.ai_generate_service import AIGenerateService, GenerateRequest, GeneratedScript

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/ai/gateway", tags=["ai-gateway"])


def _get_request_id(x_request_id: Optional[str]) -> str:
    """从 headers 获取或生成 request_id"""
    if x_request_id:
        return x_request_id
    import uuid
    return str(uuid.uuid4())


def _get_tenant_id(x_tenant_id: Optional[str]) -> str:
    """从 headers 获取 tenant_id，默认 'default'"""
    return x_tenant_id or "default"


# ==================== AI Generate ====================


@router.post(
    "/generate",
    summary="AI 内容生成",
    description="基于自然语言 prompt 生成脚本/代码，优先 AI 生成，降级到模板匹配。",
)
async def generate_script(
    prompt: str,
    language: str = "bash",
    level: Optional[str] = None,
    x_request_id: Optional[str] = Header(default=None, convert_underscores=False),
    x_tenant_id: Optional[str] = Header(default=None, convert_underscores=False),
) -> Dict[str, Any]:
    """
    AI 脚本生成

    - **prompt**: 自然语言描述
    - **language**: 目标语言 (bash/python/javascript)
    - **level**: 难度级别（可选）
    """
    request_id = _get_request_id(x_request_id)
    tenant_id = _get_tenant_id(x_tenant_id)
    logger.info(
        "AI generate request",
        extra={"request_id": request_id, "language": language, "tenant_id": tenant_id},
    )

    generate_service = AIGenerateService()
    script = await generate_service.generate_script(
        GenerateRequest(prompt=prompt, language=language, level=level)
    )

    return {
        "request_id": request_id,
        "tenant_id": tenant_id,
        "data": script.to_dict(),
    }


# ==================== AI Diagnose ====================


@router.post(
    "/diagnose",
    summary="AI 诊断",
    description="诊断错误信息并建议修复方案。",
)
async def diagnose_error(
    error_message: str,
    error_stack: Optional[str] = None,
    context: Optional[Dict[str, Any]] = None,
    x_request_id: Optional[str] = Header(default=None, convert_underscores=False),
    x_tenant_id: Optional[str] = Header(default=None, convert_underscores=False),
) -> Dict[str, Any]:
    """
    AI 错误诊断

    - **error_message**: 错误信息
    - **error_stack**: 堆栈信息（可选）
    - **context**: 上下文信息（可选）
    """
    request_id = _get_request_id(x_request_id)
    tenant_id = _get_tenant_id(x_tenant_id)
    logger.info(
        "AI diagnose request",
        extra={"request_id": request_id, "tenant_id": tenant_id},
    )

    # 通过 AIGateway 执行诊断请求
    gateway_request = AIRequest(
        scenario=AIScenario.ROOT_CAUSE_DIAGNOSIS,
        input={
            "error_message": error_message,
            "error_stack": error_stack or "",
            "context": context or {},
        },
        options=AIRequestOptions(fallback_enabled=True),
        context=AIRequestContext(tenant_id=tenant_id, trace_id=request_id),
    )

    response = await ai_gateway.execute(gateway_request)

    return {
        "request_id": request_id,
        "tenant_id": tenant_id,
        "success": response.success,
        "data": response.data,
        "source": response.source,
        "degradation_reason": response.degradation_reason,
        "error": response.error,
        "latency_ms": response.latency,
    }


# ==================== Models ====================


@router.get(
    "/models",
    summary="列出可用模型/Provider",
    description="返回当前可用的 AI Provider 和网关状态。",
)
async def list_models(
    x_request_id: Optional[str] = Header(default=None, convert_underscores=False),
) -> Dict[str, Any]:
    """列出可用的 AI 模型和 Provider"""
    request_id = _get_request_id(x_request_id)
    logger.info("List AI models", extra={"request_id": request_id})

    providers = ai_gateway.get_available_providers()
    current_provider = ai_gateway.get_current_provider()
    health_summary = ai_gateway.get_dual_circuit_health_summary()

    return {
        "request_id": request_id,
        "data": {
            "providers": providers,
            "current_provider": current_provider,
            "health_summary": health_summary,
        },
    }


# ==================== Health ====================


@router.get(
    "/health",
    summary="网关健康状态",
    description="返回所有 AI 场景的健康状态和熔断器摘要。",
)
async def gateway_health(
    x_request_id: Optional[str] = Header(default=None, convert_underscores=False),
) -> Dict[str, Any]:
    """AI 网关健康检查"""
    request_id = _get_request_id(x_request_id)
    logger.info("AI gateway health check", extra={"request_id": request_id})

    all_health = await ai_gateway.get_all_health()
    circuit_summary = ai_gateway.get_circuit_breaker_manager()["get_health_summary"]()

    return {
        "request_id": request_id,
        "data": {
            "scenarios": [h.model_dump() for h in all_health],
            "summary": circuit_summary,
        },
    }


# ==================== Prompt Security ====================


@router.post(
    "/security/analyze",
    summary="Prompt 安全分析",
    description="分析 prompt 是否存在安全威胁（注入、绕过等）。",
    response_model=Dict[str, Any],
)
async def analyze_prompt_security(
    prompt: str,
    x_request_id: Optional[str] = Header(default=None, convert_underscores=False),
) -> Dict[str, Any]:
    """
    Prompt 安全分析

    - **prompt**: 待检测的 prompt 文本
    """
    request_id = _get_request_id(x_request_id)
    logger.info("Prompt security analysis", extra={"request_id": request_id})

    from src.services.prompt_security import PromptSecurity
    security = PromptSecurity()
    analysis = security.analyze(prompt)

    return {
        "request_id": request_id,
        "data": analysis.model_dump(),
    }
