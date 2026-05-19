"""Agent API Module for Orion Platform SDK"""

from typing import Any, Dict, List, Optional


class AgentAPI:
    """API for interacting with AI Agents"""

    def __init__(self, client):
        self.client = client

    def run(
        self,
        agent_id: str,
        prompt: str,
        context: Optional[Dict[str, Any]] = None,
        wait: bool = False,
    ) -> Dict[str, Any]:
        """
        Run an AI agent with a prompt

        Args:
            agent_id: The ID of the agent to run
            prompt: The prompt to send to the agent
            context: Optional context data
            wait: Whether to wait for completion (default: False)

        Returns:
            Agent run response
        """
        return self.client.post(
            "/v1/agents/execute",
            json={
                "agentId": agent_id,
                "prompt": prompt,
                "context": context,
                "wait": wait,
            },
        )

    def get_status(self, run_id: str) -> Dict[str, Any]:
        """
        Get the status of an agent run

        Args:
            run_id: The ID of the run

        Returns:
            Agent status response
        """
        return self.client.get(f"/v1/agents/runs/{run_id}")

    def list_agents(self) -> List[Dict[str, Any]]:
        """
        List all available agents

        Returns:
            List of agent info
        """
        return self.client.get("/v1/agents")

    def cancel_run(self, run_id: str) -> None:
        """
        Cancel a running agent

        Args:
            run_id: The ID of the run to cancel
        """
        self.client.post(f"/v1/agents/runs/{run_id}/cancel")

    def get_logs(self, run_id: str) -> List[str]:
        """
        Get logs for an agent run

        Args:
            run_id: The ID of the run

        Returns:
            List of log lines
        """
        response = self.client.get(f"/v1/agents/runs/{run_id}/logs")
        return response.get("logs", [])