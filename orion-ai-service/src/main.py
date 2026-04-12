"""
Orion AI Service - FastAPI 应用入口

启动 FastAPI 应用，初始化 NATS 订阅，注册事件处理器。
"""

import logging
import sys
from contextlib import asynccontextmanager
from typing import Any, Dict

from fastapi import FastAPI

from src.config import settings
from src.events import handle_code_pr_opened, handle_pipeline_run_completed
from src.events.subscriber import NATSSubscriber
from src.services.ai_service import ai_service

# ==================== 日志配置 ====================


def setup_logging() -> None:
    """配置日志格式和级别"""
    log_format = logging.Formatter(
        "%(asctime)s [%(levelname)s] %(name)s: %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )

    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(log_format)

    root_logger = logging.getLogger()
    root_logger.setLevel(getattr(logging, settings.log_level.upper(), logging.INFO))
    root_logger.addHandler(handler)


# ==================== 应用状态 ====================


class AppState:
    """应用全局状态"""

    def __init__(self):
        self.nats_subscriber: Any = None


app_state = AppState()


# ==================== 生命周期管理 ====================


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    应用生命周期管理

    启动时：连接 NATS，注册订阅
    关闭时：断开 NATS 连接
    """
    logger = logging.getLogger(__name__)
    logger.info(f"Starting {settings.app_name} v{settings.app_version}")

    # 初始化 AI 服务
    await ai_service.initialize()

    # 初始化并连接 NATS
    subscriber = NATSSubscriber(settings)
    try:
        await subscriber.connect()
        app_state.nats_subscriber = subscriber

        # 注册事件处理器并订阅主题
        topics = settings.subscribed_topics_list

        # 映射主题到处理器
        topic_handlers = {
            "pipeline.run.completed": handle_pipeline_run_completed,
            "code.pr.opened": handle_code_pr_opened,
        }

        for topic in topics:
            handler = topic_handlers.get(topic)
            if handler:
                logger.info(f"Subscribing to {topic}")
                await subscriber.subscribe(topic, handler)
            else:
                logger.warning(
                    f"No handler for topic [{topic}], skipping subscription"
                )

        logger.info(f"Subscribed to {len(topics)} topics: {topics}")

    except Exception as e:
        logger.error(f"Failed to initialize NATS subscriber: {e}")
        # 不阻断服务启动，NATS 可后续重连
        app_state.nats_subscriber = subscriber

    logger.info(f"{settings.app_name} started successfully")

    yield

    # 关闭时清理
    logger.info("Shutting down...")
    if app_state.nats_subscriber:
        await app_state.nats_subscriber.close()
    logger.info("Shutdown complete")


# ==================== FastAPI 应用 ====================


app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    description="Orion AI Service - AI 增强域基础服务",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

# 注册 API 路由
from src.api.routes import router as api_router  # noqa: E402

app.include_router(api_router)


# ==================== 根路由 ====================


@app.get("/", tags=["root"])
async def root() -> Dict[str, str]:
    """根路径，返回服务信息"""
    return {
        "service": settings.app_name,
        "version": settings.app_version,
        "docs": "/docs",
    }
