"""
LLM Trace 仓储层

提供 LLM 调用追踪记录的存储接口，使用内存字典作为默认实现。
"""

import logging
from datetime import datetime
from typing import Dict, List, Optional

from src.models.trace import LLMTraceRecord

logger = logging.getLogger(__name__)


# ==================== 仓储接口 ====================


class LLMTraceRepository:
    """LLM Trace 仓储接口"""

    def save_trace(self, trace: LLMTraceRecord) -> None:
        raise NotImplementedError

    def get_trace(self, trace_id: str) -> Optional[LLMTraceRecord]:
        raise NotImplementedError

    def list_traces(
        self,
        model: Optional[str] = None,
        start_time: Optional[datetime] = None,
        end_time: Optional[datetime] = None,
        limit: int = 100,
    ) -> List[LLMTraceRecord]:
        raise NotImplementedError


# ==================== 内存实现 ====================


class InMemoryLLMTraceRepository(LLMTraceRepository):
    """基于内存字典的 LLM Trace 仓储"""

    def __init__(self):
        self._traces: Dict[str, LLMTraceRecord] = {}

    def save_trace(self, trace: LLMTraceRecord) -> None:
        """保存追踪记录"""
        self._traces[trace.trace_id] = trace
        logger.debug(
            "LLM trace saved",
            extra={"trace_id": trace.trace_id, "model": trace.model},
        )

    def get_trace(self, trace_id: str) -> Optional[LLMTraceRecord]:
        """获取单个追踪记录"""
        return self._traces.get(trace_id)

    def list_traces(
        self,
        model: Optional[str] = None,
        start_time: Optional[datetime] = None,
        end_time: Optional[datetime] = None,
        limit: int = 100,
    ) -> List[LLMTraceRecord]:
        """列出追踪记录，支持按模型和时间范围过滤"""
        results = list(self._traces.values())

        if model:
            results = [t for t in results if t.model == model]

        if start_time:
            results = [t for t in results if t.created_at >= start_time]

        if end_time:
            results = [t for t in results if t.created_at <= end_time]

        # 按创建时间倒序排列
        results.sort(key=lambda t: t.created_at, reverse=True)

        return results[:limit]


# 全局内存仓储实例
llm_trace_repository = InMemoryLLMTraceRepository()
