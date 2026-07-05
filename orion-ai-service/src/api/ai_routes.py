"""
AI 领域基础设施路由

提供 AI 生成、分析、诊断三个核心端点。
Phase A 返回模拟数据，Phase B 接入实际模型调用。
"""

import logging
import uuid
from datetime import datetime, timezone
from typing import Any, Dict

from fastapi import APIRouter, Header, HTTPException
from fastapi.responses import JSONResponse

from src.models.ai_models import (
    AIAnalyzeRequest,
    AIAnalyzeResponse,
    AIDiagnoseRequest,
    AIDiagnoseResponse,
    AIDiagnoseSeverity,
    AIGenerateRequest,
    AIGenerateResponse,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/ai", tags=["ai"])


def _get_request_id(x_request_id: Optional[str]) -> str:
    """从 headers 获取或生成 request_id"""
    if x_request_id:
        return x_request_id
    return str(uuid.uuid4())


# ==================== AI 生成 ====================


@router.post(
    "/generate",
    response_model=AIGenerateResponse,
    summary="AI 生成",
    description="接收 prompt，返回模拟生成结果。Phase A 返回固定响应。",
)
async def generate(
    request: AIGenerateRequest,
    x_request_id: Optional[str] = Header(default=None, convert_underscores=False),
) -> AIGenerateResponse:
    """
    AI 生成端点

    - **prompt**: 生成提示词
    - **context**: 上下文信息（可选）
    - **model**: 指定模型（可选，默认使用系统配置）
    """
    request_id = _get_request_id(x_request_id)
    logger.info(
        "AI generate request received",
        extra={"request_id": request_id, "model": request.model},
    )

    # Phase A: 返回模拟响应
    return AIGenerateResponse(
        id=str(uuid.uuid4()),
        content=f"[MOCK] Generated response for: {request.prompt[:100]}...",
        model=request.model or "mock-model-v1",
        tokens_used=len(request.prompt.split()) * 2,
        created_at=datetime.now(timezone.utc),
    )


# ==================== AI 分析 ====================


@router.post(
    "/analyze",
    response_model=AIAnalyzeResponse,
    summary="AI 分析",
    description="接收分析请求，返回模拟分析结果。Phase A 返回固定响应。",
)
async def analyze(
    request: AIAnalyzeRequest,
    x_request_id: Optional[str] = Header(default=None, convert_underscores=False),
) -> AIAnalyzeResponse:
    """
    AI 分析端点

    - **type**: 分析类型 (pipeline / code / cost)
    - **data**: 待分析数据
    """
    request_id = _get_request_id(x_request_id)
    logger.info(
        "AI analyze request received",
        extra={"request_id": request_id, "type": request.type.value},
    )

    # Phase A: 返回模拟响应
    mock_result = {
        "summary": f"[MOCK] Analysis of type '{request.type.value}' completed.",
        "details": request.data,
        "issues_found": 0,
        "suggestions": [],
    }

    return AIAnalyzeResponse(
        id=str(uuid.uuid4()),
        type=request.type.value,
        result=mock_result,
        confidence=0.85,
        created_at=datetime.now(timezone.utc),
    )


# ==================== AI 诊断 ====================


@router.post(
    "/diagnose",
    response_model=AIDiagnoseResponse,
    summary="AI 诊断",
    description="接收症状描述，返回模拟诊断结果。Phase A 返回固定响应。",
)
async def diagnose(
    request: AIDiagnoseRequest,
    x_request_id: Optional[str] = Header(default=None, convert_underscores=False),
) -> AIDiagnoseResponse:
    """
    AI 诊断端点

    - **symptoms**: 症状描述列表
    - **context**: 上下文信息（可选）
    """
    request_id = _get_request_id(x_request_id)
    logger.info(
        "AI diagnose request received",
        extra={"request_id": request_id, "symptoms_count": len(request.symptoms)},
    )

    # Phase A: 返回模拟响应
    severity = AIDiagnoseSeverity.LOW
    if len(request.symptoms) > 3:
        severity = AIDiagnoseSeverity.MEDIUM
    if len(request.symptoms) > 5:
        severity = AIDiagnoseSeverity.HIGH

    return AIDiagnoseResponse(
        id=str(uuid.uuid4()),
        diagnosis=f"[MOCK] Diagnosed {len(request.symptoms)} symptom(s). No critical issues found.",
        severity=severity,
        recommendations=[
            "Review logs for more details.",
            "Check resource utilization.",
        ],
        created_at=datetime.now(timezone.utc),
    )
