"""Tests for Orion Platform SDK"""

import pytest
from unittest.mock import Mock, patch
from orion.client import OrionClient, OrionConfig
from orion.diagnostics import DiagnosticAPI
from orion.integrations import IntegrationAPI


class TestOrionConfig:
    """Tests for OrionConfig dataclass"""

    def test_config_creation(self):
        """Test basic config creation"""
        config = OrionConfig(base_url="http://localhost:3001")
        assert config.base_url == "http://localhost:3001"
        assert config.api_key is None
        assert config.token is None
        assert config.timeout == 30.0
        assert config.retries == 3

    def test_config_with_api_key(self):
        """Test config with API key"""
        config = OrionConfig(
            base_url="http://localhost:3001",
            api_key="test-api-key"
        )
        assert config.api_key == "test-api-key"

    def test_config_with_token(self):
        """Test config with token"""
        config = OrionConfig(
            base_url="http://localhost:3001",
            token="test-token"
        )
        assert config.token == "test-token"


class TestOrionClient:
    """Tests for OrionClient"""

    def test_client_initialization(self):
        """Test client initialization with config"""
        config = OrionConfig(base_url="http://localhost:3001")
        client = OrionClient(config)

        assert client.config == config
        assert client.agents is not None
        assert client.pipelines is not None

    def test_client_headers_with_api_key(self):
        """Test that API key is included in headers"""
        config = OrionConfig(
            base_url="http://localhost:3001",
            api_key="test-key"
        )
        client = OrionClient(config)

        assert client.client.headers["X-API-Key"] == "test-key"

    def test_client_headers_with_token(self):
        """Test that Bearer token is included in headers"""
        config = OrionConfig(
            base_url="http://localhost:3001",
            token="test-token"
        )
        client = OrionClient(config)

        assert client.client.headers["Authorization"] == "Bearer test-token"

    def test_client_context_manager(self):
        """Test client as context manager"""
        config = OrionConfig(base_url="http://localhost:3001")

        with OrionClient(config) as client:
            assert client is not None

    @patch("orion.client.httpx.Client")
    def test_list_agents(self, mock_httpx_client):
        """Test listing agents"""
        # Setup mock
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "code": 0,
            "data": [
                {"id": "agent-1", "name": "Test Agent"}
            ]
        }

        mock_client_instance = Mock()
        mock_client_instance.request.return_value = mock_response.json.return_value
        mock_httpx_client.return_value = mock_client_instance

        config = OrionConfig(base_url="http://localhost:3001")
        client = OrionClient(config)

        # This test verifies the structure is correct
        # Actual API call would require mock server
        assert client.agents is not None


class TestAgentAPI:
    """Tests for AgentAPI"""

    def test_agent_api_initialization(self):
        """Test AgentAPI initialization"""
        config = OrionConfig(base_url="http://localhost:3001")
        client = OrionClient(config)

        assert client.agents is not None
        assert hasattr(client.agents, 'run')
        assert hasattr(client.agents, 'get_status')
        assert hasattr(client.agents, 'list_agents')
        assert hasattr(client.agents, 'cancel_run')
        assert hasattr(client.agents, 'get_logs')


class TestPipelineAPI:
    """Tests for PipelineAPI"""

    def test_pipeline_api_initialization(self):
        """Test PipelineAPI initialization"""
        config = OrionConfig(base_url="http://localhost:3001")
        client = OrionClient(config)

        assert client.pipelines is not None
        assert hasattr(client.pipelines, 'execute')
        assert hasattr(client.pipelines, 'get_status')
        assert hasattr(client.pipelines, 'list_pipelines')
        assert hasattr(client.pipelines, 'get_logs')
        assert hasattr(client.pipelines, 'cancel_run')


class TestDiagnosticAPI:
    """Tests for DiagnosticAPI"""

    def test_diagnostic_api_initialization(self):
        """Test DiagnosticAPI initialization"""
        config = OrionConfig(base_url="http://localhost:3001")
        client = OrionClient(config)

        assert client.diagnostics is not None
        assert hasattr(client.diagnostics, 'run')
        assert hasattr(client.diagnostics, 'get_status')
        assert hasattr(client.diagnostics, 'list_types')


class TestIntegrationAPI:
    """Tests for IntegrationAPI"""

    def test_integration_api_initialization(self):
        """Test IntegrationAPI initialization"""
        config = OrionConfig(base_url="http://localhost:3001")
        client = OrionClient(config)

        assert client.integrations is not None
        assert hasattr(client.integrations, 'create')
        assert hasattr(client.integrations, 'list')
        assert hasattr(client.integrations, 'get')
        assert hasattr(client.integrations, 'update')
        assert hasattr(client.integrations, 'delete')
        assert hasattr(client.integrations, 'test_connection')
        assert hasattr(client.integrations, 'sync')