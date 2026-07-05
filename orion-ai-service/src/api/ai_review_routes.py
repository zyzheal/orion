"""
AI Review 路由

提供 AI 代码审查的提交、查询、批准与拒绝能力。
Phase B 返回模拟数据，Phase C 接入实际审查引擎。
"""

import logging
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Header, HTTPException
from fastapi.responses import JSONResponse

from src.models.ai_models import (
    AIReviewApproveRequest,
    AIReviewComment,
    AIReviewRejectRequest,
    AIReviewRequest,
    AIReviewResponse,
    AIReviewStatus,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/ai", tags=["ai-review"])


def _get_request_id(x_request_id: Optional[str]) -> str:
    """从 headers 获取或生成 request_id"""
    if x_request_id:
        return x_request_id
    return str(uuid.uuid4())


# ==================== 模拟数据存储 ====================


# Phase B 使用内存模拟存储，Phase C 替换为实际存储
_MOCK_REVIEWS: Dict[str, Dict[str, Any]] = {}


def _build_mock_review(review_id: str, request: AIReviewRequest) -> Dict[str, Any]:
    """构建模拟审查记录"""
    now = datetime.now(timezone.utc)
    return {
        "id": review_id,
        "status": AIReviewStatus.PENDING,
        "summary": f"[MOCK] Review for {request.language} code submitted.",
        "comments": [
            {
                "line": 1,
                "content": "Code structure looks good.",
                "severity": "info",
                "suggestion": None,
            },
            {
                "line": 5,
                "content": "Consider adding error handling.",
                "severity": "warning",
                "suggestion": "Wrap the call in try/except.",
            },
        ],
        "score": 85.0,
        "created_at": now,
        "completed_at": None,
    }


# ==================== 路由端点 ====================


@router.post(
    "/review",
    response_model=AIReviewResponse,
    summary="提交代码审查请求",
    description="提交代码片段进行 AI 审查，返回模拟审查结果。",
)
async def submit_review(
    request: AIReviewRequest,
    x_request_id: Optional[str] = Header(default=None, convert_underscores=False),
) -> AIReviewResponse:
    """
    提交代码审查请求

    - **code**: 待审查代码
    - **language**: 编程语言
    - **context**: 审查上下文（可选）
    - **reviewers**: 指定审查人列表（可选）
    """
    request_id = _get_request_id(x_request_id)
    logger.info(
        "Submit AI review request received",
        extra={
            "request_id": request_id,
            "language": request.language,
            "code_length": len(request.code),
        },
    )

    review_id = str(uuid.uuid4())
    review = _build_mock_review(review_id, request)
    _MOCK_REVIEWS[review_id] = review

    return AIReviewResponse(**review)


@router.get(
    "/review/{review_id}",
    response_model=AIReviewResponse,
    summary="获取审查结果",
    description="根据审查 ID 返回审查结果详情。",
    responses={404: {"description": "审查不存在"}},
)
async def get_review(
    review_id: str,
    x_request_id: Optional[str] = Header(default=None, convert_underscores=False),
) -> AIReviewResponse:
    """
    获取审查结果

    - **review_id**: 审查 ID
    """
    request_id = _get_request_id(x_request_id)
    logger.info(
        "Get AI review result",
        extra={"request_id": request_id, "review_id": review_id},
    )

    review = _MOCK_REVIEWS.get(review_id)
    if not review:
        raise HTTPException(status_code=404, detail=f"Review {review_id} not found")

    return AIReviewResponse(**review)


@router.post(
    "/review/{review_id}/approve",
    response_model=AIReviewResponse,
    summary="批准审查",
    description="批准代码审查，更新审查状态为已批准。",
    responses={404: {"description": "审查不存在"}},
)
async def approve_review(
    review_id: str,
    request: AIReviewApproveRequest,
    x_request_id: Optional[str] = Header(default=None, convert_underscores=False),
) -> AIReviewResponse:
    """
    批准审查

    - **review_id**: 审查 ID
    - **comment**: 批准备注（可选）
    """
    request_id = _get_request_id(x_request_id)
    logger.info(
        "Approve AI review",
        extra={"request_id": request_id, "review_id": review_id},
    )

    review = _MOCK_REVIEWS.get(review_id)
    if not review:
        raise HTTPException(status_code=404, detail=f"Review {review_id} not found")

    if review["status"] != AIReviewStatus.PENDING:
        raise HTTPException(
            status_code=400,
            detail=f"Review {review_id} is not in pending status",
        )

    now = datetime.now(timezone.utc)
    review["status"] = AIReviewStatus.APPROVED
    review["completed_at"] = now
    if request.comment:
        review["comments"].append(
            {
                "line": None,
                "content": request.comment,
                "severity": "info",
                "suggestion": None,
            }
        )

    return AIReviewResponse(**review)


@router.post(
    "/review/{review_id}/reject",
    response_model=AIReviewResponse,
    summary="拒绝审查",
    description="拒绝代码审查，更新审查状态为已拒绝。",
    responses={404: {"description": "审查不存在"}},
)
async def reject_review(
    review_id: str,
    request: AIReviewRejectRequest,
    x_request_id: Optional[str] = Header(default=None, convert_underscores=False),
) -> AIReviewResponse:
    """
    拒绝审查

    - **review_id**: 审查 ID
    - **reason**: 拒绝原因
    - **comment**: 补充评论（可选）
    """
    request_id = _get_request_id(x_request_id)
    logger.info(
        "Reject AI review",
        extra={"request_id": request_id, "review_id": review_id, "reason": request.reason},
    )

    review = _MOCK_REVIEWS.get(review_id)
    if not review:
        raise HTTPException(status_code=404, detail=f"Review {review_id} not found")

    if review["status"] != AIReviewStatus.PENDING:
        raise HTTPException(
            status_code=400,
            detail=f"Review {review_id} is not in pending status",
        )

    now = datetime.now(timezone.utc)
    review["status"] = AIReviewStatus.REJECTED
    review["completed_at"] = now
    review["comments"].append(
        {
            "line": None,
            "content": f"[REJECTED] {request.reason}",
            "severity": "error",
            "suggestion": request.comment,
        }
    )

    return AIReviewResponse(**review)
