"""
配置管理 - 支持环境变量和默认值
"""

import os
from typing import List, Optional

from pydantic import ConfigDict, Field
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """应用配置，从环境变量加载"""

    # ==================== 应用基础配置 ====================
    app_name: str = Field(default="orion-ai-service", description="应用名称")
    app_version: str = Field(default="0.1.0", description="应用版本")
    debug: bool = Field(default=False, description="调试模式")
    host: str = Field(default="0.0.0.0", description="监听地址")
    port: int = Field(default=8000, description="监听端口")

    # ==================== NATS 配置 ====================
    nats_servers: str = Field(
        default="nats://localhost:4222",
        description="NATS 服务器地址，多个用逗号分隔",
    )
    nats_user: Optional[str] = Field(default=None, description="NATS 认证用户")
    nats_pass: Optional[str] = Field(default=None, description="NATS 认证密码")
    nats_token: Optional[str] = Field(default=None, description="NATS Token 认证")
    nats_max_reconnect: int = Field(default=-1, description="最大重连次数，-1 表示无限")
    nats_reconnect_interval: int = Field(default=2000, description="重连间隔 (ms)")
    nats_connect_timeout: int = Field(default=10000, description="连接超时 (ms)")

    # ==================== NATS JetStream 配置 ====================
    nats_stream_name: str = Field(
        default="orion-ai-stream", description="JetStream 流名称"
    )
    nats_durable_name: str = Field(
        default="orion-ai-consumer", description="JetStream 持久化消费者名称"
    )
    nats_max_ack_pending: int = Field(default=100, description="最大未确认消息数")

    # ==================== 日志配置 ====================
    log_level: str = Field(default="INFO", description="日志级别")
    log_format: str = Field(default="json", description="日志格式 (json/text)")

    # ==================== AI 服务配置（预留） ====================
    ai_model_endpoint: Optional[str] = Field(
        default=None, description="AI 模型服务地址 (TASK-302 实现)"
    )
    ai_api_key: Optional[str] = Field(
        default=None, description="AI 模型 API Key"
    )
    ai_timeout: int = Field(default=60, description="AI 模型请求超时 (秒)")

    # ==================== 订阅主题 ====================
    subscribed_topics: str = Field(
        default="pipeline.run.completed,code.pr.opened",
        description="订阅的事件主题，逗号分隔",
    )

    @property
    def nats_servers_list(self) -> List[str]:
        """解析 NATS 服务器列表"""
        return [s.strip() for s in self.nats_servers.split(",") if s.strip()]

    @property
    def subscribed_topics_list(self) -> List[str]:
        """解析订阅主题列表"""
        return [t.strip() for t in self.subscribed_topics.split(",") if t.strip()]

    model_config = ConfigDict(
        env_prefix="ORION_AI_",
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
    )


# 全局配置实例
settings = Settings()
