"""
Shared utilities for the AI service.

Provides prompt building, text processing, metric tracking, etc.
"""

import json
import hashlib
from typing import Any, Optional


def build_system_prompt(role: str, guidelines: list[str]) -> str:
    """Build a standardized system prompt."""
    lines = [f"You are an AI assistant specializing in {role}.", "", "Guidelines:"]
    for g in guidelines:
        lines.append(f"- {g}")
    lines.append("")
    lines.append("Respond in JSON format when possible. Be concise and accurate.")
    return "\n".join(lines)


def truncate_text(text: str, max_length: int, suffix: str = "...[truncated]") -> str:
    """Truncate text to max_length characters."""
    if len(text) <= max_length:
        return text
    return text[: max_length - len(suffix)] + suffix


def safe_json_parse(content: str, default: Any = None) -> Any:
    """Safely parse JSON, returning default on failure."""
    try:
        return json.loads(content)
    except (json.JSONDecodeError, TypeError):
        return default


def compute_text_hash(text: str) -> str:
    """Compute a short hash for text content (used for caching)."""
    return hashlib.sha256(text.encode("utf-8")).hexdigest()[:16]


def estimate_token_count(text: str) -> int:
    """Estimate token count from text length (rough: 4 chars per token)."""
    return max(1, len(text) // 4)
