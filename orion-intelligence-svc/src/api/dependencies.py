"""
FastAPI dependency injection for orion-intelligence-svc.
"""

from functools import lru_cache

from src.services.ai_service import AIService
from src.services.llm_client import LLMClient, LLMSettings


@lru_cache
def get_llm_client() -> LLMClient:
    """Get cached LLM client instance."""
    settings = LLMSettings()
    return LLMClient(settings=settings)


def get_ai_service() -> AIService:
    """Get AI service instance."""
    client = get_llm_client()
    return AIService(llm_client=client)
