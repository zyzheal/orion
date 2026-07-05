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


class AIDecisionFeatureImportance(BaseModel):
    """决策特征重要性"""

    decision_id: str = Field(..., description="决策 ID")
    features: Dict[str, float] = Field(..., description="特征权重映射")
    top_factor: str = Field(..., description="最重要特征")


class AIDecisionConfidence(BaseModel):
    """决策置信度详情"""

    decision_id: str = Field(..., description="决策 ID")
    overall_confidence: float = Field(..., ge=0.0, le=1.0, description="综合置信度")
    factors: Dict[str, float] = Field(..., description="各因素贡献权重")
    confidence_level: str = Field(..., description="置信度等级 (high/medium/low/very_low)")
    recommendation: str = Field(..., description="基于置信度的建议")


class AIDecisionHistoryItem(BaseModel):
    """决策历史条目"""

    id: str = Field(..., description="决策 ID")
    title: str = Field(..., description="决策标题")
    status: str = Field(..., description="决策状态")
    confidence: float = Field(..., ge=0.0, le=1.0, description="置信度")
    created_at: Optional[datetime] = Field(default=None, description="创建时间")
    recommendation: Optional[str] = Field(default=None, description="推荐方案")


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


# ==================== AI Chat ====================


class AIChatMessage(BaseModel):
    """聊天消息"""

    role: str = Field(..., description="消息角色 (user/assistant/system)")
    content: str = Field(..., description="消息内容")


class AIChatRequest(BaseModel):
    """AI 对话请求"""

    messages: List[AIChatMessage] = Field(..., min_length=1, description="消息列表")
    model: Optional[str] = Field(default=None, description="指定模型，留空使用默认模型")


class AIChatResponse(BaseModel):
    """AI 对话响应"""

    id: str = Field(..., description="对话 ID")
    message: str = Field(..., description="AI 回复内容")
    model: str = Field(..., description="使用的模型")
    tokens_used: int = Field(..., description="消耗的 token 数量")
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        description="创建时间",
    )


# ==================== AI Embed ====================


class AIEmbedRequest(BaseModel):
    """代码嵌入请求"""

    code: str = Field(..., min_length=1, description="代码文本")
    model: Optional[str] = Field(default="text-embedding-ada-002", description="嵌入模型")


class AIEmbedResponse(BaseModel):
    """代码嵌入响应"""

    id: str = Field(..., description="嵌入任务 ID")
    embedding: List[float] = Field(..., description="嵌入向量")
    model: str = Field(..., description="使用的模型")
    dimension: int = Field(..., description="向量维度")


# ==================== AI Search ====================


class AISearchRequest(BaseModel):
    """语义搜索请求"""

    query: str = Field(..., min_length=1, description="搜索查询文本")
    top_k: int = Field(default=10, ge=1, le=100, description="返回前 k 个结果")


class AISearchResultItem(BaseModel):
    """语义搜索结果项"""

    code_id: str = Field(..., description="代码片段唯一标识")
    similarity: float = Field(..., description="余弦相似度 (0-1)")
    metadata: Dict[str, Any] = Field(default_factory=dict, description="附加元数据")


class AISearchResponse(BaseModel):
    """语义搜索响应"""

    id: str = Field(..., description="搜索任务 ID")
    query: str = Field(..., description="搜索查询")
    results: List[AISearchResultItem] = Field(..., description="搜索结果列表")
    total: int = Field(..., description="结果总数")
