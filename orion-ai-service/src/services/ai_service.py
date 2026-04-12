"""
AI 服务基类

提供 AI 分析的核心接口，具体实现（模型调用、推理逻辑）
在 TASK-302 中完成。
"""

import logging
from abc import ABC, abstractmethod
from typing import Any, Dict, List, Optional

from src.config import Settings, settings

logger = logging.getLogger(__name__)


class AIServiceBase(ABC):
    """
    AI 服务抽象基类

    定义 AI 分析的通用接口，子类需实现具体的分析方法。
    """

    def __init__(self, config: Settings = settings):
        self.config = config
        self._initialized = False

    @property
    def is_available(self) -> bool:
        """AI 服务是否可用"""
        return self._initialized and self.config.ai_model_endpoint is not None

    async def initialize(self) -> None:
        """
        初始化 AI 服务

        子类应实现与 AI 模型服务的连接建立。
        """
        if self.config.ai_model_endpoint:
            logger.info(
                f"Initializing AI service at {self.config.ai_model_endpoint}"
            )
            await self._do_initialize()
            self._initialized = True
        else:
            logger.info(
                "AI model endpoint not configured, "
                "AI service running in placeholder mode (TASK-302)"
            )
            self._initialized = False

    @abstractmethod
    async def _do_initialize(self) -> None:
        """子类实现具体初始化逻辑"""
        ...

    @abstractmethod
    async def analyze_pipeline(
        self, pipeline_data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        分析 Pipeline 运行结果

        Args:
            pipeline_data: Pipeline 运行数据

        Returns:
            分析结果
        """
        ...

    @abstractmethod
    async def analyze_code_review(
        self, diff: str, context: Dict[str, Any]
    ) -> List[Dict[str, Any]]:
        """
        分析代码变更

        Args:
            diff: 代码 diff
            context: 上下文信息（文件类型、PR 信息等）

        Returns:
            审查意见列表
        """
        ...


class AIServicePlaceholder(AIServiceBase):
    """
    AI 服务占位实现

    在 TASK-302 之前返回模拟结果，用于验证事件处理流程。
    """

    async def _do_initialize(self) -> None:
        """占位初始化"""
        logger.info("AI service placeholder initialized")

    async def analyze_pipeline(
        self, pipeline_data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        占位 Pipeline 分析

        TODO (TASK-302): 接入真实 AI 模型
        """
        return {
            "status": "placeholder",
            "message": "AI pipeline analysis to be implemented in TASK-302",
            "input_summary": {
                "pipeline_id": pipeline_data.get("pipeline_id"),
                "status": pipeline_data.get("status"),
                "duration_ms": pipeline_data.get("duration_ms"),
            },
        }

    async def analyze_code_review(
        self, diff: str, context: Dict[str, Any]
    ) -> List[Dict[str, Any]]:
        """
        占位代码审查

        TODO (TASK-302): 接入真实 AI 模型
        """
        return [
            {
                "type": "placeholder",
                "severity": "info",
                "message": "AI code review to be implemented in TASK-302",
                "context": {
                    "pr_id": context.get("pr_id"),
                    "changed_files_count": len(diff.split("\n")) if diff else 0,
                },
            }
        ]


# 全局 AI 服务实例（占位实现）
ai_service = AIServicePlaceholder()
