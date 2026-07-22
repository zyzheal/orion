"""
VectorStore 数据模型

定义嵌入记录和语义搜索结果。
"""

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


class EmbeddingRecord(BaseModel):
    """嵌入记录"""

    code_id: str = Field(..., description="代码片段唯一标识")
    embedding: List[float] = Field(..., description="嵌入向量")
    metadata: Dict[str, Any] = Field(default_factory=dict, description="附加元数据")
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        description="创建时间",
    )


class SearchResult(BaseModel):
    """语义搜索结果"""

    code_id: str = Field(..., description="代码片段唯一标识")
    similarity: float = Field(..., description="余弦相似度 (0-1)")
    metadata: Dict[str, Any] = Field(default_factory=dict, description="附加元数据")
