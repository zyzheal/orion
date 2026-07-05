"""
AI 领域基础设施路由

提供 AI 生成、分析、诊断三个核心端点。
通过 AIService 规则引擎 + 模板匹配实现实际业务逻辑。
"""

import logging
from typing import Any, Dict, Optional

from fastapi import APIRouter, Header, HTTPException

from src.models.ai_models import (
    AIAnalyzeRequest,
    AIAnalyzeResponse,
    AIDiagnoseRequest,
    AIDiagnoseResponse,
    AIDiagnoseSeverity,
    AIGenerateRequest,
    AIGenerateResponse,
)
from src.repositories.ai_result_repository import ai_result_repository
from src.services.ai_service import ai_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/ai", tags=["ai"])


def _get_request_id(x_request_id: Optional[str]) -> str:
    """从 headers 获取或生成 request_id"""
    if x_request_id:
        return x_request_id
    import uuid
    return str(uuid.uuid4())


def _get_tenant_id(x_tenant_id: Optional[str]) -> str:
    """从 headers 获取 tenant_id，默认 'default'"""
    return x_tenant_id or "default"


# ==================== AI 生成 ====================


@router.post(
    "/generate",
    response_model=AIGenerateResponse,
    summary="AI 生成",
    description="接收 prompt，调用 AI 服务生成内容，不可用时降级到模板匹配。",
)
async def generate(
    request: AIGenerateRequest,
    x_request_id: Optional[str] = Header(default=None, convert_underscores=False),
    x_tenant_id: Optional[str] = Header(default=None, convert_underscores=False),
) -> AIGenerateResponse:
    """
    AI 生成端点

    - **prompt**: 生成提示词
    - **context**: 上下文信息（可选）
    - **model**: 指定模型（可选，默认使用系统配置）
    """
    request_id = _get_request_id(x_request_id)
    tenant_id = _get_tenant_id(x_tenant_id)
    logger.info(
        "AI generate request received",
        extra={"request_id": request_id, "model": request.model, "tenant_id": tenant_id},
    )

    response = await ai_service.generate_text(
        prompt=request.prompt,
        context=request.context,
        model=request.model,
    )

    # 持久化生成结果
    ai_result_repository.save_generation(
        {
            "id": response.id,
            "prompt": request.prompt,
            "context": request.context,
            "model": response.model,
            "content": response.content,
            "tokens_used": response.tokens_used,
            "created_at": response.created_at,
        },
        tenant_id=tenant_id,
    )

    return response


# ==================== AI 分析 ====================


@router.post(
    "/analyze",
    response_model=AIAnalyzeResponse,
    summary="AI 分析",
    description="接收分析请求，根据类型调用对应分析方法（pipeline/code/cost）。",
)
async def analyze(
    request: AIAnalyzeRequest,
    x_request_id: Optional[str] = Header(default=None, convert_underscores=False),
    x_tenant_id: Optional[str] = Header(default=None, convert_underscores=False),
) -> AIAnalyzeResponse:
    """
    AI 分析端点

    - **type**: 分析类型 (pipeline / code / cost)
    - **data**: 待分析数据
    """
    request_id = _get_request_id(x_request_id)
    tenant_id = _get_tenant_id(x_tenant_id)
    logger.info(
        "AI analyze request received",
        extra={"request_id": request_id, "type": request.type.value, "tenant_id": tenant_id},
    )

    response = await ai_service.analyze(
        analysis_type=request.type.value,
        data=request.data,
    )

    # 持久化分析结果
    ai_result_repository.save_analysis(
        {
            "id": response.id,
            "type": request.type.value,
            "data": request.data,
            "result": response.result,
            "confidence": response.confidence,
            "created_at": response.created_at,
        },
        tenant_id=tenant_id,
    )

    return response


# ==================== AI 诊断 ====================


@router.post(
    "/diagnose",
    response_model=AIDiagnoseResponse,
    summary="AI 诊断",
    description="接收症状描述，基于规则引擎匹配返回诊断结论和修复建议。",
)
async def diagnose(
    request: AIDiagnoseRequest,
    x_request_id: Optional[str] = Header(default=None, convert_underscores=False),
    x_tenant_id: Optional[str] = Header(default=None, convert_underscores=False),
) -> AIDiagnoseResponse:
    """
    AI 诊断端点

    - **symptoms**: 症状描述列表
    - **context**: 上下文信息（可选）
    """
    request_id = _get_request_id(x_request_id)
    tenant_id = _get_tenant_id(x_tenant_id)
    logger.info(
        "AI diagnose request received",
        extra={"request_id": request_id, "symptoms_count": len(request.symptoms), "tenant_id": tenant_id},
    )

    response = await ai_service.diagnose(
        symptoms=request.symptoms,
        context=request.context,
    )

    # 持久化诊断结果
    ai_result_repository.save_diagnosis(
        {
            "id": response.id,
            "symptoms": request.symptoms,
            "context": request.context,
            "diagnosis": response.diagnosis,
            "severity": response.severity.value,
            "recommendations": [r.dict() for r in response.recommendations],
            "created_at": response.created_at,
        },
        tenant_id=tenant_id,
    )

    return response
