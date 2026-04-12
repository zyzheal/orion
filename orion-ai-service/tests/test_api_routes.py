"""
API 路由测试
"""

import pytest
from httpx import AsyncClient, ASGITransport

from src.main import app


@pytest.fixture
def anyio_backend():
    return "asyncio"


@pytest.mark.anyio
async def test_root_endpoint():
    """测试根路径"""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/")
        assert response.status_code == 200
        data = response.json()
        assert data["service"] == "orion-ai-service"
        assert "version" in data
        assert "docs" in data


@pytest.mark.anyio
async def test_healthz_endpoint():
    """测试健康检查端点"""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/api/v1/ai/healthz")
        assert response.status_code == 200
        data = response.json()
        assert "status" in data
        assert "version" in data
        assert "components" in data
        # 没有 NATS 连接时，NATS 组件应为 False
        assert data["components"]["nats"] is False


@pytest.mark.anyio
async def test_status_endpoint():
    """测试服务状态端点"""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/api/v1/ai/status")
        assert response.status_code == 200
        data = response.json()
        assert data["app_name"] == "orion-ai-service"
        assert "subscribed_topics" in data
        assert "nats" in data
        assert "ai_service" in data
        assert isinstance(data["subscribed_topics"], list)


@pytest.mark.anyio
async def test_docs_endpoint():
    """测试 Swagger 文档端点"""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/docs")
        assert response.status_code == 200


@pytest.mark.anyio
async def test_openapi_json():
    """测试 OpenAPI JSON 端点"""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/openapi.json")
        assert response.status_code == 200
        data = response.json()
        assert "openapi" in data
        assert "info" in data
        assert data["info"]["title"] == "orion-ai-service"
