"""
LLM Trace 数据模型

对应 TS: src/services/observability/LLMTraceRecord.ts
"""

from datetime import datetime, timezone
from typing import Any, Dict, Optional

from pydantic import BaseModel, Field


class LLMTraceRecord(BaseModel):
    """LLM 调用追踪记录"""

    trace_id: str = Field(..., description="追踪 ID")
    model: str = Field(..., description="使用的模型名称")
    prompt: str = Field(..., description="输入 prompt")
    response: str = Field(..., description="模型响应")
    tokens_prompt: int = Field(default=0, description="Prompt token 数量")
    tokens_completion: int = Field(default=0, description="Completion token 数量")
    latency_ms: int = Field(default=0, description="响应延迟 (ms)")
    metadata: Dict[str, Any] = Field(default_factory=dict, description="元数据")
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), description="创建时间")
