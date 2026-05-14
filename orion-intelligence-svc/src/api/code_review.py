"""
Code Review API

POST /api/v1/ai/code-review - AI-powered code review
"""

import time

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from src.services.ai_service import AIService
from src.api.dependencies import get_ai_service

router = APIRouter()


class CodeReviewRequest(BaseModel):
    """Request body for code review."""
    pr_id: str | None = Field(None, description="Pull request identifier")
    repository: str = Field(..., description="Repository name")
    code_diff: str = Field(..., description="Git diff or code content to review")
    review_focus: list[str] | None = Field(
        None,
        description="Specific focus areas: security, performance, style, bugs, architecture",
    )
    context_files: list[dict] | None = Field(
        None,
        description="Related files for context: [{path, content}]",
    )
    language: str | None = Field(None, description="Programming language")


class ReviewComment(BaseModel):
    """Single review comment."""
    file: str = Field(..., description="File path")
    line_start: int | None = Field(None, description="Starting line number")
    line_end: int | None = Field(None, description="Ending line number")
    severity: str = Field(..., description="critical | warning | suggestion | nit")
    category: str = Field(..., description="bug | security | performance | style | design")
    comment: str = Field(..., description="Review comment")
    suggestion: str | None = Field(None, description="Suggested fix code")


class CodeReviewResponse(BaseModel):
    """Response body for code review."""
    pr_id: str | None
    summary: str = Field(..., description="Overall review summary")
    comments: list[ReviewComment]
    quality_score: float | None = Field(None, ge=0.0, le=10.0, description="Overall code quality score")
    processing_time_ms: float


@router.post("/code-review", response_model=CodeReviewResponse)
async def review_code(
    request: CodeReviewRequest,
    ai_service: AIService = Depends(get_ai_service),
):
    """
    Perform AI-powered code review on a diff or code snippet.

    Analyzes code for bugs, security issues, performance problems,
    style violations, and architectural concerns.
    """
    start = time.monotonic()

    result = await ai_service.review_code(request)

    comments = []
    for issue in result.get("issues", []):
        comments.append(ReviewComment(
            file=request.repository,
            severity=issue.get("severity", "suggestion"),
            category=issue.get("category", "general"),
            comment=issue.get("message", ""),
            suggestion=issue.get("suggestion"),
        ))

    return CodeReviewResponse(
        pr_id=request.pr_id,
        summary=result.get("overall_assessment", "Review completed"),
        comments=comments,
        quality_score=result.get("quality_score"),
        processing_time_ms=round((time.monotonic() - start) * 1000, 2),
    )
