"""
LLM Client

Handles communication with external LLM APIs.
Supports OpenAI-compatible endpoints (can route to Claude, GPT, Qwen, etc.)
"""

from typing import Optional, AsyncGenerator
import httpx
from openai import AsyncOpenAI
from pydantic_settings import BaseSettings
from structlog import get_logger

logger = get_logger()


class LLMSettings(BaseSettings):
    """LLM configuration from environment variables."""

    llm_api_base: str = "https://api.openai.com/v1"
    llm_api_key: str = ""
    llm_model: str = "gpt-4o"
    llm_timeout: int = 120
    llm_max_retries: int = 3
    llm_temperature: float = 0.1

    model_config = {"env_prefix": "LLM_", "env_file": ".env"}


class LLMClient:
    """
    Async LLM client with retry logic and token tracking.

    Uses OpenAI-compatible API format for maximum flexibility.
    """

    def __init__(self, settings: Optional[LLMSettings] = None):
        self.settings = settings or LLMSettings()
        self.client = AsyncOpenAI(
            api_key=self.settings.llm_api_key,
            base_url=self.settings.llm_api_base,
            timeout=httpx.Timeout(self.settings.llm_timeout),
            max_retries=self.settings.llm_max_retries,
        )
        logger.info(
            "LLMClient initialized",
            base_url=self.settings.llm_api_base,
            model=self.settings.llm_model,
        )

    async def chat_completion(
        self,
        messages: list[dict],
        model: Optional[str] = None,
        temperature: Optional[float] = None,
        max_tokens: Optional[int] = None,
        response_format: Optional[dict] = None,
    ) -> dict:
        """
        Send a chat completion request to the LLM.

        Args:
            messages: List of {role, content} message dicts
            model: Override model name
            temperature: Override temperature
            max_tokens: Max tokens to generate
            response_format: Optional JSON schema for structured output

        Returns:
            dict with {content, usage, model}
        """
        model_name = model or self.settings.llm_model
        temp = temperature if temperature is not None else self.settings.llm_temperature

        kwargs = {
            "model": model_name,
            "messages": messages,
            "temperature": temp,
        }
        if max_tokens:
            kwargs["max_tokens"] = max_tokens
        if response_format:
            kwargs["response_format"] = response_format

        try:
            response = await self.client.chat.completions.create(**kwargs)
            content = response.choices[0].message.content
            usage = {
                "prompt_tokens": response.usage.prompt_tokens if response.usage else 0,
                "completion_tokens": response.usage.completion_tokens if response.usage else 0,
                "total_tokens": response.usage.total_tokens if response.usage else 0,
            }
            logger.info("LLM request completed", model=model_name, usage=usage)
            return {"content": content, "usage": usage, "model": response.model}
        except Exception as e:
            logger.error("LLM request failed", error=str(e), model=model_name)
            raise

    async def chat_completion_stream(
        self,
        messages: list[dict],
        model: Optional[str] = None,
        temperature: Optional[float] = None,
    ) -> AsyncGenerator[str, None]:
        """
        Stream chat completion response.

        Yields content chunks as they arrive.
        """
        model_name = model or self.settings.llm_model
        temp = temperature if temperature is not None else self.settings.llm_temperature

        stream = await self.client.chat.completions.create(
            model=model_name,
            messages=messages,
            temperature=temp,
            stream=True,
        )

        async for chunk in stream:
            delta = chunk.choices[0].delta
            if delta and delta.content:
                yield delta.content

    async def close(self):
        """Close HTTP client."""
        await self.client.close()
