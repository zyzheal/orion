"""Integration API Module for Orion Platform SDK"""

from typing import Any, Dict, List, Optional


class IntegrationAPI:
    """API for managing integrations"""

    def __init__(self, client):
        self.client = client

    def create(
        self,
        connector_type: str,
        config: Dict[str, Any],
    ) -> Dict[str, Any]:
        """
        Create a new integration

        Args:
            connector_type: Type of connector (e.g., 'gitlab', 'jira')
            config: Connector configuration

        Returns:
            Created integration info
        """
        return self.client.post(
            "/v1/integrations",
            json={"type": connector_type, "config": config},
        )

    def list(self) -> List[Dict[str, Any]]:
        """List all integrations"""
        return self.client.get("/v1/integrations")

    def get(self, integration_id: str) -> Dict[str, Any]:
        """Get integration by ID"""
        return self.client.get(f"/v1/integrations/{integration_id}")

    def update(
        self,
        integration_id: str,
        config: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """Update integration configuration"""
        return self.client.put(
            f"/v1/integrations/{integration_id}",
            json={"config": config} if config else {},
        )

    def delete(self, integration_id: str) -> None:
        """Delete an integration"""
        self.client.delete(f"/v1/integrations/{integration_id}")

    def test_connection(self, integration_id: str) -> Dict[str, Any]:
        """Test integration connection"""
        return self.client.post(
            f"/v1/integrations/{integration_id}/test"
        )

    def sync(
        self,
        integration_id: str,
        action: str,
        params: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """
        Sync data through integration

        Args:
            integration_id: Integration ID
            action: Action to execute
            params: Action parameters

        Returns:
            Sync result
        """
        return self.client.post(
            f"/v1/integrations/{integration_id}/sync",
            json={"action": action, "params": params or {}},
        )
