"""
LLM Trace 服务

提供 LLM 调用的追踪能力，记录每次 AI 请求的输入、输出、延迟和 token 使用情况。
"""

import logging
from datetime import datetime
from typing import Dict, List, Optional

from src.models.trace import LLMTraceRecord
from src.repositories.llm_trace_repository import (
    LLMTraceRepository,
    InMemoryLLMTraceRepository,
    llm_trace_repository,
)

logger = logging.getLogger(__name__)


class LLMTraceService:
    """
    LLM 调用追踪服务

    使用内存字典作为 fallback，也可注入持久化仓储。
    """

    def __init__(self, repository: Optional[LLMTraceRepository] = None):
        self._repository = repository or llm_trace_repository
        # in-memory fallback
        self._traces: Dict[str, LLMTraceRecord] = {}

    def start_trace(self, trace_id: str, model: str, prompt: str, metadata: Dict) -> None:
        """开始追踪"""
        trace = LLMTraceRecord(
            trace_id=trace_id,
            model=model,
            prompt=prompt,
            response="",
            tokens_prompt=0,
            tokens_completion=0,
            latency_ms=0,
            metadata=metadata or {},
        )
        self._traces[trace_id] = trace
        logger.debug(
            "LLM trace started",
            extra={"trace_id": trace_id, "model": model},
        )

    def end_trace(
        self,
        trace_id: str,
        response: str,
        tokens_used: Dict,
        latency_ms: int,
    ) -> None:
        """结束追踪"""
        trace = self._traces.get(trace_id)
        if not trace:
            logger.warning(f"Trace not found: {trace_id}")
            return

        trace.response = response
        trace.tokens_prompt = tokens_used.get("prompt", 0)
        trace.tokens_completion = tokens_used.get("completion", 0)
        trace.latency_ms = latency_ms

        try:
            self._repository.save_trace(trace)
        except Exception as e:
            logger.warning(f"[LLMTraceService] Failed to persist trace: {e}")

        logger.debug(
            "LLM trace ended",
            extra={"trace_id": trace_id, "latency_ms": latency_ms},
        )

    def get_trace(self, trace_id: str) -> Optional[LLMTraceRecord]:
        """获取追踪记录"""
        in_memory = self._traces.get(trace_id)
        if in_memory:
            return in_memory
        try:
            return self._repository.get_trace(trace_id)
        except Exception as e:
            logger.warning(f"[LLMTraceService] Failed to get trace: {e}")
            return None

    def list_traces(
        self,
        model: Optional[str] = None,
        start_time: Optional[datetime] = None,
        end_time: Optional[datetime] = None,
        limit: int = 100,
    ) -> List[LLMTraceRecord]:
        """列出追踪记录（合并仓储 + 内存）"""
        results: List[LLMTraceRecord] = []

        # 从仓储获取
        try:
            repo_results = self._repository.list_traces(
                model=model,
                start_time=start_time,
                end_time=end_time,
                limit=limit,
            )
            if repo_results:
                results.extend(repo_results)
        except Exception as e:
            logger.warning(f"[LLMTraceService] Failed to list traces from repository: {e}")

        # 合并内存中的追踪（去重）
        seen_ids = {t.trace_id for t in results}
        for trace in self._traces.values():
            if trace.trace_id not in seen_ids:
                results.append(trace)

        # 过滤
        if model:
            results = [t for t in results if t.model == model]
        if start_time:
            results = [t for t in results if t.created_at >= start_time]
        if end_time:
            results = [t for t in results if t.created_at <= end_time]

        results.sort(key=lambda t: t.created_at, reverse=True)
        return results[:limit]
