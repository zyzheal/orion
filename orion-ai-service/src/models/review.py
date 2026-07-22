"""
Code Review 数据模型

对应 TS: src/services/code-review/types.ts
"""

from enum import Enum
from typing import List, Optional

from pydantic import BaseModel, Field


class ReviewSeverity(str, Enum):
    """审查问题严重程度"""

    CRITICAL = "critical"
    WARNING = "warning"
    INFO = "info"


class ReviewFinding(BaseModel):
    """审查发现项"""

    rule_id: str = Field(..., description="规则 ID")
    severity: ReviewSeverity = Field(..., description="严重程度")
    message: str = Field(..., description="问题描述")
    line: Optional[int] = Field(default=None, description="问题所在行号")
    suggestion: Optional[str] = Field(default=None, description="修复建议")


class ReviewResult(BaseModel):
    """代码审查结果"""

    findings: List[ReviewFinding] = Field(default_factory=list, description="发现项列表")
    summary: str = Field(default="", description="审查摘要")
    score: float = Field(default=0.0, description="质量评分 (0-100)")
