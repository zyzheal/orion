"""
AI 领域数据模型 - 请求/响应模型
"""

from datetime import datetime, timezone
from enum import Enum
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


# ==================== AI 生成 ====================


class AIGenerateRequest(BaseModel):
    """AI 生成请求"""

    prompt: str = Field(..., min_length=1, max_length=10000, description="生成提示词")
    context: Optional[Dict[str, Any]] = Field(default=None, description="上下文信息")
    model: Optional[str] = Field(default=None, description="指定模型，留空使用默认模型")


class AIGenerateResponse(BaseModel):
    """AI 生成响应"""

    id: str = Field(..., description="生成任务 ID")
    content: str = Field(..., description="生成内容")
    model: str = Field(..., description="使用的模型")
    tokens_used: int = Field(..., description="消耗的 token 数量")
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        description="创建时间",
    )


# ==================== AI 分析 ====================


class AIAnalysisType(str, Enum):
    """分析类型"""

    PIPELINE = "pipeline"
    CODE = "code"
    COST = "cost"


class AIAnalyzeRequest(BaseModel):
    """AI 分析请求"""

    type: AIAnalysisType = Field(..., description="分析类型")
    data: Dict[str, Any] = Field(..., description="待分析数据")


class AIAnalyzeResponse(BaseModel):
    """AI 分析响应"""

    id: str = Field(..., description="分析任务 ID")
    type: str = Field(..., description="分析类型")
    result: Dict[str, Any] = Field(..., description="分析结果")
    confidence: float = Field(..., ge=0.0, le=1.0, description="置信度")
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        description="创建时间",
    )


# ==================== AI 诊断 ====================


class AIDiagnoseRequest(BaseModel):
    """AI 诊断请求"""

    symptoms: List[str] = Field(..., min_length=1, description="症状描述列表")
    context: Optional[Dict[str, Any]] = Field(default=None, description="上下文信息")


class AIDiagnoseSeverity(str, Enum):
    """诊断严重程度"""

    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class AIDiagnoseResponse(BaseModel):
    """AI 诊断响应"""

    id: str = Field(..., description="诊断任务 ID")
    diagnosis: str = Field(..., description="诊断结论")
    severity: AIDiagnoseSeverity = Field(..., description="严重程度")
    recommendations: List[str] = Field(..., description="修复建议")
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        description="创建时间",
    )


# ==================== AI Decision ====================


class AIDecisionStatus(str, Enum):
    """决策状态"""

    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    IMPLEMENTED = "implemented"


class AIDecisionRequest(BaseModel):
    """创建 AI 决策请求"""

    title: str = Field(..., min_length=1, max_length=200, description="决策标题")
    description: str = Field(..., min_length=1, max_length=5000, description="决策描述")
    context: Optional[Dict[str, Any]] = Field(default=None, description="决策上下文")
    options: Optional[List[str]] = Field(default=None, description="候选选项列表")


class AIDecisionResponse(BaseModel):
    """AI 决策响应"""

    id: str = Field(..., description="决策 ID")
    title: str = Field(..., description="决策标题")
    description: str = Field(..., description="决策描述")
    status: AIDecisionStatus = Field(..., description="决策状态")
    recommendation: Optional[str] = Field(default=None, description="AI 推荐方案")
    confidence: float = Field(default=0.0, ge=0.0, le=1.0, description="置信度")
    context: Optional[Dict[str, Any]] = Field(default=None, description="决策上下文")
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        description="创建时间",
    )
    updated_at: Optional[datetime] = Field(default=None, description="更新时间")


class AIExplanationResponse(BaseModel):
    """决策解释响应"""

    decision_id: str = Field(..., description="决策 ID")
    reasoning: str = Field(..., description="推理过程")
    factors: List[str] = Field(..., description="考虑因素列表")
    confidence: float = Field(..., ge=0.0, le=1.0, description="置信度")
    alternatives: Optional[List[str]] = Field(default=None, description="备选方案")


# ==================== AI Review ====================


class AIReviewStatus(str, Enum):
    """审查状态"""

    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    CHANGES_REQUESTED = "changes_requested"


class AIReviewRequest(BaseModel):
    """提交 AI 审查请求"""

    code: str = Field(..., min_length=1, description="待审查代码")
    language: str = Field(..., min_length=1, max_length=50, description="编程语言")
    context: Optional[Dict[str, Any]] = Field(default=None, description="审查上下文")
    reviewers: Optional[List[str]] = Field(default=None, description="指定审查人列表")


class AIReviewComment(BaseModel):
    """审查评论"""

    line: Optional[int] = Field(default=None, description="代码行号")
    content: str = Field(..., description="评论内容")
    severity: str = Field(default="info", description="严重程度 (info/warning/error)")
    suggestion: Optional[str] = Field(default=None, description="修复建议")


class AIReviewResponse(BaseModel):
    """AI 审查响应"""

    id: str = Field(..., description="审查 ID")
    status: AIReviewStatus = Field(..., description="审查状态")
    summary: str = Field(..., description="审查摘要")
    comments: List[AIReviewComment] = Field(default_factory=list, description="审查评论列表")
    score: float = Field(default=0.0, ge=0.0, le=100.0, description="代码质量评分")
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        description="创建时间",
    )
    completed_at: Optional[datetime] = Field(default=None, description="完成时间")


class AIReviewApproveRequest(BaseModel):
    """批准审查请求"""

    comment: Optional[str] = Field(default=None, max_length=500, description="批准备注")


class AIReviewRejectRequest(BaseModel):
    """拒绝审查请求"""

    reason: str = Field(..., min_length=1, max_length=1000, description="拒绝原因")
    comment: Optional[str] = Field(default=None, max_length=500, description="补充评论")
