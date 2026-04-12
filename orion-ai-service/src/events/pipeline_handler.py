"""
Pipeline 事件处理器

处理 pipeline.* 相关事件，预留 AI 分析接口。
具体 AI 逻辑在 TASK-302 中实现。
"""

import logging
from typing import Any, Dict

from src.models import PipelineRunCompletedEvent

logger = logging.getLogger(__name__)


async def handle_pipeline_run_completed(subject: str, data: Dict[str, Any]) -> None:
    """
    处理 Pipeline 运行完成事件

    当 Pipeline 运行完成时触发，可用于：
    - AI 分析构建日志，识别潜在问题 (TASK-302)
    - 智能测试选择，基于变更范围推荐测试 (TASK-302)
    - 构建性能分析与优化建议 (TASK-302)

    Args:
        subject: NATS 主题 (e.g., "pipeline.run.completed")
        data: CloudEvents 格式的事件数据
    """
    try:
        # 解析事件数据
        event_data = data.get("data", data)
        pipeline_event = PipelineRunCompletedEvent(**event_data)

        logger.info(
            f"Pipeline run completed: pipeline_id={pipeline_event.pipeline_id}, "
            f"run_id={pipeline_event.run_id}, "
            f"status={pipeline_event.status}, "
            f"duration={pipeline_event.duration_ms}ms"
        )

        # TODO (TASK-302): 调用 AI 分析服务
        # - 分析构建日志
        # - 生成构建报告
        # - 推荐优化建议
        await _trigger_ai_pipeline_analysis(pipeline_event)

    except Exception as e:
        logger.error(f"Failed to handle pipeline.run.completed event: {e}", exc_info=True)
        raise


async def _trigger_ai_pipeline_analysis(event: PipelineRunCompletedEvent) -> None:
    """
    触发 AI Pipeline 分析（预留接口）

    TASK-302 实现具体 AI 逻辑。

    Args:
        event: Pipeline 完成事件
    """
    logger.info(
        f"[AI Analysis] Triggering pipeline analysis for run_id={event.run_id} "
        f"(AI logic to be implemented in TASK-302)"
    )
    # TODO (TASK-302):
    # 1. 获取 Pipeline 详细日志和产物
    # 2. 调用 AI 模型分析
    # 3. 存储分析结果
    # 4. 发布分析结果事件
    pass
