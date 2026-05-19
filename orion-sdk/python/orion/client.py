"""Orion Platform SDK Client"""

import httpx
import time
from dataclasses import dataclass, field
from typing import Any, Optional


@dataclass
class OrionConfig:
    """Configuration for Orion Platform SDK"""

    base_url: str
    api_key: Optional[str] = None
    token: Optional[str] = None
    timeout: float = 30.0  # seconds
    retries: int = 3


class OrionClient:
    """Main Orion Platform SDK Client"""

    def __init__(self, config: OrionConfig):
        self.config = config
        self.client = httpx.Client(
            base_url=config.base_url,
            timeout=config.timeout,
            headers=self._build_headers(),
        )
        self.agents = None
        self.pipelines = None
        self._initialize_apis()

    def _build_headers(self) -> dict:
        """Build request headers"""
        headers = {"Content-Type": "application/json"}
        if self.config.api_key:
            headers["X-API-Key"] = self.config.api_key
        if self.config.token:
            headers["Authorization"] = f"Bearer {self.config.token}"
        return headers

    def _initialize_apis(self):
        """Initialize sub-APIs"""
        from .agents import AgentAPI
        from .pipelines import PipelineAPI
        from .diagnostics import DiagnosticAPI
        from .integrations import IntegrationAPI

        self.agents = AgentAPI(self)
        self.pipelines = PipelineAPI(self)
        self.diagnostics = DiagnosticAPI(self)
        self.integrations = IntegrationAPI(self)

    def _request(
        self,
        method: str,
        path: str,
        retries: Optional[int] = None,
        **kwargs,
    ) -> Any:
        """Make HTTP request with exponential backoff retry for 5xx errors"""
        retry_count = 0
        max_retries = retries if retries is not None else self.config.retries

        while True:
            try:
                response = self.client.request(method, path, **kwargs)
                # Retry on 5xx errors
                if response.status_code >= 500 and retry_count < max_retries:
                    retry_count += 1
                    # Exponential backoff
                    time.sleep(pow(2, retry_count - 1))
                    continue
                response.raise_for_status()
                return response.json()
            except httpx.HTTPStatusError:
                raise
            except httpx.RequestError:
                raise

    def get(self, path: str, **kwargs) -> Any:
        """Perform GET request"""
        return self._request("GET", path, **kwargs)

    def post(self, path: str, **kwargs) -> Any:
        """Perform POST request"""
        return self._request("POST", path, **kwargs)

    def put(self, path: str, **kwargs) -> Any:
        """Perform PUT request"""
        return self._request("PUT", path, **kwargs)

    def delete(self, path: str, **kwargs) -> Any:
        """Perform DELETE request"""
        return self._request("DELETE", path, **kwargs)

    def set_token(self, token: str) -> None:
        """Update authentication token"""
        self.config.token = token
        self.client.headers["Authorization"] = f"Bearer {token}"

    def get_http_client(self) -> httpx.Client:
        """Get the underlying HTTP client"""
        return self.client

    def close(self) -> None:
        """Close the HTTP client"""
        self.client.close()

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        self.close()