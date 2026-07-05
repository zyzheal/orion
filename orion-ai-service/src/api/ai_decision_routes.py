"""
AI Decision 路由

提供 AI 决策历史的查询、创建与解释能力。
Phase B 返回模拟数据，Phase C 接入实际决策引擎。
"""

import logging
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Header, HTTPException
from fastapi.responses import JSONResponse

from src.models.ai_models import (
    AIDecisionRequest,
    AIDecisionResponse,
    AIDecisionStatus,
    AIExplanationResponse,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/ai", tags=["ai-decision"])


def _get_request_id(x_request_id: Optional[str]) -> str:
    """从 headers 获取或生成 request_id"""
    if x_request_id:
        return x_request_id
    return str(uuid.uuid4())


# ==================== 模拟数据存储 ====================


# Phase B 使用内存模拟存储，Phase C 替换为实际存储
_MOCK_DECISIONS: Dict[str, Dict[str, Any]] = {}


def _build_mock_decision(decision_id: str, request: AIDecisionRequest) -> Dict[str, Any]:
    """构建模拟决策记录"""
    now = datetime.now(timezone.utc)
    return {
        "id": decision_id,
        "title": request.title,
        "description": request.description,
        "status": AIDecisionStatus.PENDING,
        "recommendation": None,
        "confidence": 0.0,
        "context": request.context or {},
        "options": request.options or [],
        "created_at": now,
        "updated_at": None,
    }


# ==================== 路由端点 ====================


@router.get(
    "/decisions",
    response_model=List[AIDecisionResponse],
    summary="列出 AI 决策历史",
    description="返回模拟的 AI 决策历史列表。",
)
async def list_decisions(
    x_request_id: Optional[str] = Header(default=None, convert_underscores=False),
) -> List[AIDecisionResponse]:
    """
    列出 AI 决策历史

    - 返回所有模拟决策记录
    """
    request_id = _get_request_id(x_request_id)
    logger.info(
        "List AI decisions request received",
        extra={"request_id": request_id, "count": len(_MOCK_DECISIONS)},
    )

    return [AIDecisionResponse(**d) for d in _MOCK_DECISIONS.values()]


@router.get(
    "/decisions/{decision_id}",
    response_model=AIDecisionResponse,
    summary="获取单个决策详情",
    description="根据决策 ID 返回决策详情。",
    responses={404: {"description": "决策不存在"}},
)
async def get_decision(
    decision_id: str,
    x_request_id: Optional[str] = Header(default=None, convert_underscores=False),
) -> AIDecisionResponse:
    """
    获取单个决策详情

    - **decision_id**: 决策 ID
    """
    request_id = _get_request_id(x_request_id)
    logger.info(
        "Get AI decision detail",
        extra={"request_id": request_id, "decision_id": decision_id},
    )

    decision = _MOCK_DECISIONS.get(decision_id)
    if not decision:
        raise HTTPException(status_code=404, detail=f"Decision {decision_id} not found")

    return AIDecisionResponse(**decision)


@router.post(
    "/decisions",
    response_model=AIDecisionResponse,
    summary="创建新决策",
    description="提交新的 AI 决策请求，返回模拟决策记录。",
)
async def create_decision(
    request: AIDecisionRequest,
    x_request_id: Optional[str] = Header(default=None, convert_underscores=False),
) -> AIDecisionResponse:
    """
    创建新决策

    - **title**: 决策标题
    - **description**: 决策描述
    - **context**: 决策上下文（可选）
    - **options**: 候选选项列表（可选）
    """
    request_id = _get_request_id(x_request_id)
    logger.info(
        "Create AI decision request received",
        extra={"request_id": request_id, "title": request.title},
    )

    decision_id = str(uuid.uuid4())
    decision = _build_mock_decision(decision_id, request)
    _MOCK_DECISIONS[decision_id] = decision

    return AIDecisionResponse(**decision)


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

    decision = _MOCK_DECISIONS.get(decision_id)
    if not decision:
        raise HTTPException(status_code=404, detail=f"Decision {decision_id} not found")

    return AIExplanationResponse(
        decision_id=decision_id,
        reasoning="[MOCK] 基于历史数据与规则引擎的综合分析，当前选项中最优解已自动生成。",
        factors=[
            "历史类似决策成功率",
            "当前系统负载",
            "风险承受阈值",
            "业务影响范围",
        ],
        confidence=0.82,
        alternatives=["保守方案", "激进方案", "折中方案"],
    )
