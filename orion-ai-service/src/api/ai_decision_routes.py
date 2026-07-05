"""
AI Decision 路由

提供 AI 决策历史的查询、创建与解释能力。
通过 AIService + AIResultRepository 实现持久化决策管理。
"""

import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Header, HTTPException

from src.models.ai_models import (
    AIDecisionRequest,
    AIDecisionResponse,
    AIDecisionStatus,
    AIExplanationResponse,
)
from src.repositories.ai_result_repository import ai_result_repository
from src.services.ai_service import ai_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/ai", tags=["ai-decision"])


def _get_request_id(x_request_id: Optional[str]) -> str:
    """从 headers 获取或生成 request_id"""
    if x_request_id:
        return x_request_id
    import uuid
    return str(uuid.uuid4())


def _get_tenant_id(x_tenant_id: Optional[str]) -> str:
    """从 headers 获取 tenant_id，默认 'default'"""
    return x_tenant_id or "default"


# ==================== 路由端点 ====================


@router.get(
    "/decisions",
    response_model=List[AIDecisionResponse],
    summary="列出 AI 决策历史",
    description="从仓储中返回所有 AI 决策记录。",
)
async def list_decisions(
    x_request_id: Optional[str] = Header(default=None, convert_underscores=False),
    x_tenant_id: Optional[str] = Header(default=None, convert_underscores=False),
) -> List[AIDecisionResponse]:
    """
    列出 AI 决策历史

    - 返回所有已持久化的决策记录
    """
    request_id = _get_request_id(x_request_id)
    tenant_id = _get_tenant_id(x_tenant_id)
    logger.info(
        "List AI decisions request received",
        extra={"request_id": request_id, "tenant_id": tenant_id},
    )

    decisions = ai_result_repository.list_decisions(tenant_id=tenant_id)
    return [_decision_dict_to_response(d) for d in decisions]


@router.get(
    "/decisions/{decision_id}",
    response_model=AIDecisionResponse,
    summary="获取单个决策详情",
    description="根据决策 ID 从仓储中返回决策详情。",
    responses={404: {"description": "决策不存在"}},
)
async def get_decision(
    decision_id: str,
    x_request_id: Optional[str] = Header(default=None, convert_underscores=False),
    x_tenant_id: Optional[str] = Header(default=None, convert_underscores=False),
) -> AIDecisionResponse:
    """
    获取单个决策详情

    - **decision_id**: 决策 ID
    """
    request_id = _get_request_id(x_request_id)
    tenant_id = _get_tenant_id(x_tenant_id)
    logger.info(
        "Get AI decision detail",
        extra={"request_id": request_id, "decision_id": decision_id, "tenant_id": tenant_id},
    )

    decision = ai_result_repository.get_decision(decision_id, tenant_id=tenant_id)
    if not decision:
        raise HTTPException(status_code=404, detail=f"Decision {decision_id} not found")

    return _decision_dict_to_response(decision)


@router.post(
    "/decisions",
    response_model=AIDecisionResponse,
    summary="创建新决策",
    description="提交新的 AI 决策请求，基于规则引擎生成推荐并持久化。",
)
async def create_decision(
    request: AIDecisionRequest,
    x_request_id: Optional[str] = Header(default=None, convert_underscores=False),
    x_tenant_id: Optional[str] = Header(default=None, convert_underscores=False),
) -> AIDecisionResponse:
    """
    创建新决策

    - **title**: 决策标题
    - **description**: 决策描述
    - **context**: 决策上下文（可选）
    - **options**: 候选选项列表（可选）
    """
    request_id = _get_request_id(x_request_id)
    tenant_id = _get_tenant_id(x_tenant_id)
    logger.info(
        "Create AI decision request received",
        extra={"request_id": request_id, "title": request.title, "tenant_id": tenant_id},
    )

    return await ai_service.make_decision(
        title=request.title,
        description=request.description,
        context=request.context,
        options=request.options,
        tenant_id=tenant_id,
    )


@router.get(
    "/decisions/{decision_id}/explanations",
    response_model=AIExplanationResponse,
    summary="获取决策解释",
    description="返回指定决策的推理过程、考虑因素和置信度。",
    responses={404: {"description": "决策不存在"}},
)
async def get_decision_explanation(
    decision_id: str,
    x_request_id: Optional[str] = Header(default=None, convert_underscores=False),
) -> AIExplanationResponse:
    """
    获取决策解释

    - **decision_id**: 决策 ID
    """
    request_id = _get_request_id(x_request_id)
    logger.info(
        "Get AI decision explanation",
        extra={"request_id": request_id, "decision_id": decision_id},
    )

    explanation = await ai_service.get_decision_explanation(decision_id)
    if not explanation:
        raise HTTPException(status_code=404, detail=f"Decision {decision_id} not found")

    return AIExplanationResponse(**explanation)


# ==================== 辅助方法 ====================


def _decision_dict_to_response(d: Dict[str, Any]) -> AIDecisionResponse:
    """将仓储返回的决策字典转换为 AIDecisionResponse"""
    updated_at = d.get("updated_at")
    if updated_at and isinstance(updated_at, str):
        updated_at = datetime.fromisoformat(updated_at)

    return AIDecisionResponse(
        id=d["id"],
        title=d.get("title", ""),
        description=d.get("description", ""),
        status=AIDecisionStatus(d.get("status", "pending")),
        recommendation=d.get("recommendation"),
        confidence=d.get("confidence", 0.0),
        context=d.get("context"),
        created_at=_parse_datetime(d.get("created_at")),
        updated_at=updated_at,
    )


def _parse_datetime(value: Any) -> datetime:
    """将字符串或 datetime 统一转为 datetime"""
    if isinstance(value, datetime):
        return value
    if isinstance(value, str):
        return datetime.fromisoformat(value)
    return datetime.now(timezone.utc)
