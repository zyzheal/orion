"""
配置管理测试
"""

import os

import pytest

from src.config import Settings


class TestSettings:
    """配置类测试"""

    def test_default_values(self):
        """测试默认配置值"""
        settings = Settings()
        assert settings.app_name == "orion-ai-service"
        assert settings.app_version == "0.1.0"
        assert settings.debug is False
        assert settings.host == "0.0.0.0"
        assert settings.port == 8000
        assert settings.nats_servers == "nats://localhost:4222"
        assert settings.log_level == "INFO"

    def test_nats_servers_parsing(self):
        """测试 NATS 服务器列表解析"""
        settings = Settings(nats_servers="nats://host1:4222,nats://host2:4222")
        servers = settings.nats_servers_list
        assert len(servers) == 2
        assert servers[0] == "nats://host1:4222"
        assert servers[1] == "nats://host2:4222"

    def test_nats_servers_single(self):
        """测试单个 NATS 服务器解析"""
        settings = Settings(nats_servers="nats://localhost:4222")
        servers = settings.nats_servers_list
        assert len(servers) == 1
        assert servers[0] == "nats://localhost:4222"

    def test_nats_servers_with_whitespace(self):
        """测试带空格的 NATS 服务器解析"""
        settings = Settings(nats_servers="nats://host1:4222, nats://host2:4222 , ")
        servers = settings.nats_servers_list
        assert len(servers) == 2
        assert "nats://host1:4222" in servers
        assert "nats://host2:4222" in servers

    def test_subscribed_topics_parsing(self):
        """测试订阅主题解析"""
        settings = Settings(
            subscribed_topics="pipeline.run.completed,code.pr.opened"
        )
        topics = settings.subscribed_topics_list
        assert len(topics) == 2
        assert "pipeline.run.completed" in topics
        assert "code.pr.opened" in topics

    def test_env_prefix(self):
        """测试环境变量前缀"""
        os.environ["ORION_AI_APP_NAME"] = "test-service"
        try:
            settings = Settings()
            assert settings.app_name == "test-service"
        finally:
            del os.environ["ORION_AI_APP_NAME"]

    def test_env_port_override(self):
        """测试端口环境变量覆盖"""
        os.environ["ORION_AI_PORT"] = "9000"
        try:
            settings = Settings()
            assert settings.port == 9000
        finally:
            del os.environ["ORION_AI_PORT"]
