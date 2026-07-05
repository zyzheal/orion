"""Pipeline API Module for Orion Platform SDK"""

from typing import Any, Dict, List, Optional


class PipelineAPI:
    """API for interacting with Pipelines"""

    def __init__(self, client):
        self.client = client

    def execute(
        self,
        pipeline_id: str,
        params: Optional[Dict[str, Any]] = None,
        wait: bool = False,
    ) -> Dict[str, Any]:
        """
        Execute a pipeline

        Args:
            pipeline_id: The ID of the pipeline to execute
            params: Optional parameters for the pipeline
            wait: Whether to wait for completion (default: False)

        Returns:
            Pipeline run response
        """
        return self.client.post(
            "/api/v1/pipelines/execute",
            json={
                "pipelineId": pipeline_id,
                "params": params,
                "wait": wait,
            },
        )

    def get_status(self, run_id: str) -> Dict[str, Any]:
        """
        Get the status of a pipeline run

        Args:
            run_id: The ID of the run

        Returns:
            Pipeline status response
        """
        return self.client.get(f"/api/v1/pipelines/runs/{run_id}")

    def list_pipelines(self) -> List[Dict[str, Any]]:
        """
        List all available pipelines

        Returns:
            List of pipeline info
        """
        return self.client.get("/api/v1/pipelines")

    def get_logs(self, run_id: str, offset: int = 0) -> Dict[str, Any]:
        """
        Get logs for a pipeline run

        Args:
            run_id: The ID of the run
            offset: Line offset to start from (default: 0)

        Returns:
            Pipeline log response
        """
        return self.client.get(f"/api/v1/pipelines/runs/{run_id}/logs?offset={offset}")

    def cancel_run(self, run_id: str) -> None:
        """
        Cancel a running pipeline

        Args:
            run_id: The ID of the run to cancel
        """
        self.client.post(f"/api/v1/pipelines/runs/{run_id}/cancel")