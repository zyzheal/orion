"""
AI Review 路由

提供 AI 代码审查的提交、查询、批准与拒绝能力。
通过 AIService 规则引擎 + AIResultRepository 持久化实现。
"""

import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Header, HTTPException

from src.models.ai_models import (
    AIReviewApproveRequest,
    AIReviewComment,
    AIReviewRejectRequest,
    AIReviewRequest,
    AIReviewResponse,
    AIReviewStatus,
)
from src.repositories.ai_result_repository import ai_result_repository
from src.services.ai_service import ai_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/ai", tags=["ai-review"])


def _get_request_id(x_request_id: Optional[str]) -> str:
    """从 headers 获取或生成 request_id"""
    if x_request_id:
        return x_request_id
    import uuid
    return str(uuid.uuid4())


def _get_tenant_id(x_tenant_id: Optional[str]) -> str:
    """从 headers 获取 tenant_id，默认 'default'"""
    return x_tenant_id or "default"


def _now_utc() -> datetime:
    return datetime.now(timezone.utc)


# ==================== 路由端点 ====================


@router.post(
    "/review",
    response_model=AIReviewResponse,
    summary="提交代码审查请求",
    description="提交代码片段进行 AI 审查，基于规则引擎分析并持久化结果。",
)
async def submit_review(
    request: AIReviewRequest,
    x_request_id: Optional[str] = Header(default=None, convert_underscores=False),
    x_tenant_id: Optional[str] = Header(default=None, convert_underscores=False),
) -> AIReviewResponse:
    """
    提交代码审查请求

    - **code**: 待审查代码
    - **language**: 编程语言
    - **context**: 审查上下文（可选）
    - **reviewers**: 指定审查人列表（可选）
    """
    request_id = _get_request_id(x_request_id)
    tenant_id = _get_tenant_id(x_tenant_id)
    logger.info(
        "Submit AI review request received",
        extra={
            "request_id": request_id,
            "language": request.language,
            "code_length": len(request.code),
            "tenant_id": tenant_id,
        },
    )

    review = await ai_service.review_code(
        code=request.code,
        language=request.language,
        context=request.context,
        reviewers=request.reviewers,
        tenant_id=tenant_id,
    )

    return review


@router.get(
    "/review/{review_id}",
    response_model=AIReviewResponse,
    summary="获取审查结果",
    description="根据审查 ID 从仓储中返回审查结果详情。",
    responses={404: {"description": "审查不存在"}},
)
async def get_review(
    review_id: str,
    x_request_id: Optional[str] = Header(default=None, convert_underscores=False),
    x_tenant_id: Optional[str] = Header(default=None, convert_underscores=False),
) -> AIReviewResponse:
    """
    获取审查结果

    - **review_id**: 审查 ID
    """
    request_id = _get_request_id(x_request_id)
    tenant_id = _get_tenant_id(x_tenant_id)
    logger.info(
        "Get AI review result",
        extra={"request_id": request_id, "review_id": review_id, "tenant_id": tenant_id},
    )

    review = ai_result_repository.get_review(review_id, tenant_id=tenant_id)
    if not review:
        raise HTTPException(status_code=404, detail=f"Review {review_id} not found")

    return AIReviewResponse(**review)


@router.post(
    "/review/{review_id}/approve",
    response_model=AIReviewResponse,
    summary="批准审查",
    description="批准代码审查，更新审查状态为已批准并持久化。",
    responses={404: {"description": "审查不存在"}},
)
async def approve_review(
    review_id: str,
    request: AIReviewApproveRequest,
    x_request_id: Optional[str] = Header(default=None, convert_underscores=False),
    x_tenant_id: Optional[str] = Header(default=None, convert_underscores=False),
) -> AIReviewResponse:
    """
    批准审查

    - **review_id**: 审查 ID
    - **comment**: 批准备注（可选）
    """
    request_id = _get_request_id(x_request_id)
    tenant_id = _get_tenant_id(x_tenant_id)
    logger.info(
        "Approve AI review",
        extra={"request_id": request_id, "review_id": review_id, "tenant_id": tenant_id},
    )

    review = ai_result_repository.get_review(review_id, tenant_id=tenant_id)
    if not review:
        raise HTTPException(status_code=404, detail=f"Review {review_id} not found")

    if review["status"] != AIReviewStatus.PENDING.value:
        raise HTTPException(
            status_code=400,
            detail=f"Review {review_id} is not in pending status",
        )

    now = _now_utc()
    comments = review.get("comments", [])
    if request.comment:
        comments.append(
            {
                "line": None,
                "content": request.comment,
                "severity": "info",
                "suggestion": None,
            }
        )

    ai_result_repository.save_review(
        {
            "id": review_id,
            "code": review.get("code", ""),
            "language": review.get("language", ""),
            "context": review.get("context"),
            "reviewers": review.get("reviewers"),
            "status": AIReviewStatus.APPROVED.value,
            "summary": review.get("summary", ""),
            "comments": comments,
            "score": review.get("score", 0.0),
            "created_at": review.get("created_at", now.isoformat()),
            "completed_at": now.isoformat(),
        },
        tenant_id=tenant_id,
    )

    updated = ai_result_repository.get_review(review_id, tenant_id=tenant_id)
    return AIReviewResponse(**updated)


@router.post(
    "/review/{review_id}/reject",
    response_model=AIReviewResponse,
    summary="拒绝审查",
    description="拒绝代码审查，更新审查状态为已拒绝并持久化。",
    responses={404: {"description": "审查不存在"}},
)
async def reject_review(
    review_id: str,
    request: AIReviewRejectRequest,
    x_request_id: Optional[str] = Header(default=None, convert_underscores=False),
    x_tenant_id: Optional[str] = Header(default=None, convert_underscores=False),
) -> AIReviewResponse:
    """
    拒绝审查

    - **review_id**: 审查 ID
    - **reason**: 拒绝原因
    - **comment**: 补充评论（可选）
    """
    request_id = _get_request_id(x_request_id)
    tenant_id = _get_tenant_id(x_tenant_id)
    logger.info(
        "Reject AI review",
        extra={"request_id": request_id, "review_id": review_id, "reason": request.reason, "tenant_id": tenant_id},
    )

    review = ai_result_repository.get_review(review_id, tenant_id=tenant_id)
    if not review:
        raise HTTPException(status_code=404, detail=f"Review {review_id} not found")

    if review["status"] != AIReviewStatus.PENDING.value:
        raise HTTPException(
            status_code=400,
            detail=f"Review {review_id} is not in pending status",
        )

    now = _now_utc()
    comments = review.get("comments", [])
    comments.append(
        {
            "line": None,
            "content": f"[REJECTED] {request.reason}",
            "severity": "error",
            "suggestion": request.comment,
        }
    )

    ai_result_repository.save_review(
        {
            "id": review_id,
            "code": review.get("code", ""),
            "language": review.get("language", ""),
            "context": review.get("context"),
            "reviewers": review.get("reviewers"),
            "status": AIReviewStatus.REJECTED.value,
            "summary": review.get("summary", ""),
            "comments": comments,
            "score": review.get("score", 0.0),
            "created_at": review.get("created_at", now.isoformat()),
            "completed_at": now.isoformat(),
        },
        tenant_id=tenant_id,
    )

    updated = ai_result_repository.get_review(review_id, tenant_id=tenant_id)
    return AIReviewResponse(**updated)
