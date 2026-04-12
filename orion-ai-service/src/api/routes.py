"""
API 路由 - 健康检查、状态查询等
"""

import logging
from datetime import datetime, timezone

from fastapi import APIRouter

from src.config import settings
from src.models import (
    AIServiceStatus,
    HealthCheckResponse,
    HealthStatus,
    NatsConnectionStatus,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/ai", tags=["ai-service"])


@router.get("/healthz", response_model=HealthCheckResponse)
async def health_check() -> HealthCheckResponse:
    """
    健康检查端点

    返回服务整体健康状态和各组件状态。
    """
    from src.main import app_state

    components = {}

    # 检查 NATS 连接状态
    if app_state.nats_subscriber and app_state.nats_subscriber.is_connected:
        components["nats"] = True
    else:
        components["nats"] = False

    # 检查 AI 服务可用性
    components["ai_model"] = False  # TASK-302 实现

    # 确定整体状态
    all_healthy = all(components.values())
    any_healthy = any(components.values())

    if all_healthy:
        status = HealthStatus.HEALTHY
    elif any_healthy:
        status = HealthStatus.DEGRADED
    else:
        status = HealthStatus.UNHEALTHY

    return HealthCheckResponse(
        status=status,
        version=settings.app_version,
        timestamp=datetime.now(timezone.utc),
        components=components,
    )


@router.get("/status", response_model=dict)
async def service_status() -> dict:
    """
    服务详细状态

    返回 NATS 连接信息、订阅主题列表等。
    """
    from src.main import app_state

    nats_status = NatsConnectionStatus(
        connected=(
            app_state.nats_subscriber.is_connected
            if app_state.nats_subscriber
            else False
        ),
        servers=settings.nats_servers_list,
        reconnect_attempts=(
            app_state.nats_subscriber.reconnect_attempts
            if app_state.nats_subscriber
            else 0
        ),
    )

    ai_status = AIServiceStatus(
        available=settings.ai_model_endpoint is not None,
        model_endpoint=settings.ai_model_endpoint,
    )

    return {
        "app_name": settings.app_name,
        "version": settings.app_version,
        "subscribed_topics": settings.subscribed_topics_list,
        "nats": nats_status.model_dump(),
        "ai_service": ai_status.model_dump(),
    }
