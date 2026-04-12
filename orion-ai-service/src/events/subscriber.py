"""
NATS JetStream 事件订阅器

负责连接 NATS、订阅指定主题、分发事件到对应处理器。
"""

import asyncio
import json
import logging
from datetime import datetime, timezone
from typing import Callable, Dict, List, Optional

import nats
from nats.aio.client import Client as NATSClient
from nats.aio.subscription import Subscription
from nats.errors import NoRespondersError, TimeoutError

from src.config import Settings, settings

logger = logging.getLogger(__name__)


class NATSSubscriber:
    """
    NATS JetStream 订阅管理器

    连接到 NATS JetStream，管理订阅和事件分发。
    """

    def __init__(self, config: Settings = settings):
        self.config = config
        self._client: Optional[NATSClient] = None
        self._subscriptions: Dict[str, Subscription] = {}
        self._handlers: Dict[str, Callable] = {}
        self._connected = False
        self._reconnect_attempts = 0
        self._last_connected_at: Optional[datetime] = None

    @property
    def is_connected(self) -> bool:
        """是否已连接到 NATS"""
        return self._connected and self._client and not self._client.is_closed

    @property
    def reconnect_attempts(self) -> int:
        """重连尝试次数"""
        return self._reconnect_attempts

    @property
    def last_connected_at(self) -> Optional[datetime]:
        """最后连接时间"""
        return self._last_connected_at

    async def connect(self) -> None:
        """
        连接到 NATS 服务器

        支持自动重连和连接状态回调。
        如果连接失败，会在超时后抛出异常，允许服务以降级模式启动。
        """
        servers = self.config.nats_servers_list
        logger.info(f"Connecting to NATS servers: {servers}")

        # 构建连接选项 - 使用有限的重连次数以便快速失败
        connect_kwargs = {
            "servers": servers,
            "name": self.config.app_name,
            "max_reconnect_attempts": 3,  # 初始连接最多重试 3 次
            "reconnect_time_wait": self.config.nats_reconnect_interval / 1000.0,
            "connect_timeout": self.config.nats_connect_timeout / 1000.0,
            "error_cb": self._error_callback,
            "disconnected_cb": self._disconnected_callback,
            "reconnected_cb": self._reconnected_callback,
            "closed_cb": self._closed_callback,
        }

        # 认证配置
        if self.config.nats_user and self.config.nats_pass:
            connect_kwargs["user"] = self.config.nats_user
            connect_kwargs["password"] = self.config.nats_pass
        if self.config.nats_token:
            connect_kwargs["token"] = self.config.nats_token

        try:
            # 使用 asyncio.wait_for 确保连接不会无限阻塞
            self._client = await asyncio.wait_for(
                nats.connect(**connect_kwargs),
                timeout=15.0,  # 15 秒连接超时
            )
            self._connected = True
            self._reconnect_attempts = 0
            self._last_connected_at = datetime.now(timezone.utc)
            logger.info("Successfully connected to NATS JetStream")
        except asyncio.TimeoutError:
            logger.error(
                "NATS connection timed out after 15s, "
                "service will start in degraded mode"
            )
            raise
        except Exception as e:
            logger.error(f"Failed to connect to NATS: {e}")
            raise

    async def subscribe(
        self, subject: str, handler: Callable, queue_group: Optional[str] = None
    ) -> None:
        """
        订阅指定主题

        Args:
            subject: 订阅主题，支持通配符 (e.g., "pipeline.*.*")
            handler: 事件处理回调函数，接收 (subject, data) 参数
            queue_group: 队列组名称，用于负载均衡消费
        """
        if not self.is_connected:
            raise RuntimeError("Not connected to NATS. Call connect() first.")

        # 注册处理器
        self._handlers[subject] = handler

        # 创建内部消息处理器
        async def _msg_handler(msg):
            try:
                data = json.loads(msg.data.decode("utf-8"))
                logger.info(
                    f"Received event on [{subject}]: {data.get('type', 'unknown')}"
                )
                await handler(subject, data)
                # 确认消息
                await msg.ack()
            except json.JSONDecodeError as e:
                logger.error(f"Failed to parse message on [{subject}]: {e}")
            except Exception as e:
                logger.error(f"Error handling message on [{subject}]: {e}")
                # 不确认消息，让 NATS 重发
                try:
                    await msg.nak()
                except Exception:
                    pass

        # 创建订阅
        try:
            subscription = await self._client.subscribe(
                subject,
                queue=queue_group or self.config.app_name,
                cb=_msg_handler,
            )
            self._subscriptions[subject] = subscription
            logger.info(
                f"Subscribed to [{subject}] (queue: {queue_group or self.config.app_name})"
            )
        except Exception as e:
            logger.error(f"Failed to subscribe to [{subject}]: {e}")
            raise

    async def subscribe_topics(self, topics: List[str]) -> None:
        """
        批量订阅主题列表

        Args:
            topics: 主题列表
        """
        for topic in topics:
            if topic in self._handlers:
                await self.subscribe(topic, self._handlers[topic])
            else:
                logger.warning(
                    f"No handler registered for topic [{topic}], skipping"
                )

    def register_handler(self, subject: str, handler: Callable) -> None:
        """
        注册事件处理器（在连接前调用）

        Args:
            subject: 事件主题
            handler: 处理函数
        """
        self._handlers[subject] = None  # placeholder
        logger.info(f"Registered handler for topic [{subject}]")

    async def publish(
        self, subject: str, data: dict, timeout: float = 5.0
    ) -> None:
        """
        发布事件到 NATS

        Args:
            subject: 目标主题
            data: 事件数据
            timeout: 超时时间（秒）
        """
        if not self.is_connected:
            raise RuntimeError("Not connected to NATS. Call connect() first.")

        payload = json.dumps(data).encode("utf-8")
        try:
            await self._client.publish(subject, payload)
            logger.info(f"Published to [{subject}]")
        except TimeoutError:
            logger.error(f"Timeout publishing to [{subject}]")
            raise
        except NoRespondersError:
            logger.error(f"No responders for [{subject}]")
            raise

    async def close(self) -> None:
        """关闭 NATS 连接"""
        if self._client and not self._client.is_closed:
            logger.info("Closing NATS connection")
            await self._client.drain()
            self._connected = False
            self._subscriptions.clear()

    # ==================== 连接回调 ====================

    async def _error_callback(self, err):
        """错误回调"""
        logger.error(f"NATS error: {err}")

    async def _disconnected_callback(self):
        """断开连接回调"""
        self._connected = False
        logger.warning("NATS disconnected")

    async def _reconnected_callback(self):
        """重连成功回调"""
        self._connected = True
        self._reconnect_attempts = 0
        self._last_connected_at = datetime.utcnow()
        logger.info("NATS reconnected")

    async def _closed_callback(self):
        """连接关闭回调"""
        self._connected = False
        logger.warning("NATS connection closed")


# 全局订阅器实例
subscriber = NATSSubscriber()
