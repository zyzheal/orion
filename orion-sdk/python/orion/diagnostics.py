"""Diagnostic API Module for Orion Platform SDK"""

from typing import Any, Dict, List, Optional


class DiagnosticAPI:
    """API for running diagnostics"""

    def __init__(self, client):
        self.client = client

    def run(
        self,
        diagnostic_type: str,
        target: str,
        params: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """
        Run a diagnostic check

        Args:
            diagnostic_type: Type of diagnostic to run
            target: Target resource to diagnose
            params: Optional parameters

        Returns:
            Diagnostic result
        """
        return self.client.post(
            "/api/v1/diagnostics/run",
            json={
                "type": diagnostic_type,
                "target": target,
                "params": params or {},
            },
        )

    def get_status(self, run_id: str) -> Dict[str, Any]:
        """Get status of a diagnostic run"""
        return self.client.get(f"/api/v1/diagnostics/runs/{run_id}")

    def list_types(self) -> List[Dict[str, Any]]:
        """List available diagnostic types"""
        return self.client.get("/api/v1/diagnostics/types")
