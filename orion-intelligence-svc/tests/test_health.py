"""
Tests for health and readiness endpoints.
"""

import pytest
from fastapi.testclient import TestClient

from src.main import app


@pytest.fixture
def client():
    return TestClient(app)


def test_health_check(client):
    """Health check returns healthy status."""
    response = client.get("/api/v1/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert data["service"] == "orion-intelligence-svc"


def test_readiness_check(client):
    """Readiness check returns ready status."""
    response = client.get("/api/v1/ready")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ready"


# TODO: Add tests for each AI endpoint
# TODO: Add integration tests with mocked LLM client
# TODO: Add tests for error handling and validation
