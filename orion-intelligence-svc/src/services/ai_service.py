"""
AI Service Core

Orchestrates LLM calls, RAG knowledge retrieval, and data analysis
for all AI-powered endpoints.
"""

import json
from typing import Optional, Any
from structlog import get_logger

from src.services.llm_client import LLMClient

logger = get_logger()

# Classification taxonomy
CATEGORY_TAXONOMY = {
    "infrastructure": ["server", "network", "database", "storage", "compute"],
    "application": ["bug", "feature", "error", "crash", "performance"],
    "security": ["vulnerability", "access", "auth", "compliance"],
    "operation": ["deploy", "config", "monitoring", "backup"],
    "user_management": ["user", "permission", "role", "access"],
}


class AIService:
    """
    Core AI service orchestrator.

    Coordinates between LLM client, knowledge base service (RAG),
    and ClickHouse analytics to power all AI endpoints.
    """

    def __init__(self, llm_client: LLMClient):
        self.llm_client = llm_client
        logger.info("AIService initialized")

    def _build_system_prompt(self, role: str, guidelines: list[str]) -> str:
        """Build a system prompt with role and guidelines."""
        return f"""You are an AI assistant specializing in {role}.

Guidelines:
{chr(10).join(f'- {g}' for g in guidelines)}

Respond in JSON format when possible. Be concise and accurate."""

    async def classify_ticket(self, request: Any) -> dict:
        """Classify a ticket into categories using LLM + RAG."""
        title = getattr(request, 'title', '') or getattr(request, 'title', '')
        description = getattr(request, 'description', '') or ''

        taxonomy_str = json.dumps(CATEGORY_TAXONOMY, indent=2)

        system_prompt = self._build_system_prompt(
            "IT ticket classification",
            [
                "Classify tickets into predefined categories",
                f"Use this taxonomy: {taxonomy_str}",
                "Return JSON with: category, subcategory, confidence (0-1), reasoning",
                "Confidence should reflect classification certainty",
            ]
        )

        user_prompt = f"Title: {title}\nDescription: {description}\n\nClassify this ticket."

        result = await self.llm_client.chat_completion(
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            response_format={"type": "json_object"},
        )

        try:
            classification = json.loads(result["content"])
        except json.JSONDecodeError:
            classification = {
                "category": "application",
                "subcategory": "general",
                "confidence": 0.5,
                "reasoning": "LLM response was not valid JSON, using default",
            }

        logger.info("Ticket classified", category=classification.get("category"))
        return {**classification, "usage": result.get("usage")}

    async def review_code(self, request: Any) -> dict:
        """Perform AI code review on a diff."""
        diff = getattr(request, 'diff', '') or ''
        language = getattr(request, 'language', '') or 'unknown'
        context = getattr(request, 'context', '') or ''

        max_diff_len = 8000
        if len(diff) > max_diff_len:
            diff = diff[:max_diff_len] + "\n...[diff truncated for AI review]"

        system_prompt = self._build_system_prompt(
            "senior code reviewer",
            [
                f"Review {language} code for bugs, security issues, and best practices",
                "Focus on: logic errors, security vulnerabilities, performance issues",
                "Return JSON with: issues (array of {severity, line, message, suggestion}), overall_assessment",
                "Severity levels: critical, high, medium, low, info",
                "Be specific about line numbers when possible",
            ]
        )

        user_prompt = f"Context: {context}\n\nDiff:\n```{language}\n{diff}\n```\n\nReview this code."

        result = await self.llm_client.chat_completion(
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            response_format={"type": "json_object"},
        )

        try:
            review = json.loads(result["content"])
        except json.JSONDecodeError:
            review = {
                "issues": [{"severity": "info", "message": result["content"]}],
                "overall_assessment": "Review completed",
            }

        return {**review, "usage": result.get("usage")}

    async def analyze_root_cause(self, request: Any) -> dict:
        """Analyze incident to identify root causes."""
        incident_data = getattr(request, 'incident', {}) or {}
        logs = getattr(request, 'logs', '') or ''
        metrics = getattr(request, 'metrics', {}) or {}
        timeline = getattr(request, 'timeline', '') or ''

        system_prompt = self._build_system_prompt(
            "incident root cause analyst",
            [
                "Analyze incidents to identify root causes",
                "Consider: infrastructure, application, deployment, configuration changes",
                "Return JSON with: root_cause, contributing_factors (array), impact_scope, recommended_actions (array), confidence (0-1)",
                "Be specific about the chain of events",
                "Distinguish between symptoms and root causes",
            ]
        )

        context = json.dumps({
            "incident": incident_data,
            "metrics_summary": {k: str(v)[:200] for k, v in (metrics or {}).items()},
            "timeline": timeline[:2000],
        }, default=str)

        user_prompt = f"Logs:\n{logs[:3000]}\n\nContext:\n{context}\n\nAnalyze root cause."

        result = await self.llm_client.chat_completion(
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            response_format={"type": "json_object"},
        )

        try:
            analysis = json.loads(result["content"])
        except json.JSONDecodeError:
            analysis = {
                "root_cause": result["content"][:500],
                "contributing_factors": [],
                "impact_scope": "unknown",
                "recommended_actions": ["Manual investigation required"],
                "confidence": 0.3,
            }

        return {**analysis, "usage": result.get("usage")}

    async def suggest_solution(self, request: Any) -> dict:
        """Recommend solutions based on similar resolved tickets."""
        problem = getattr(request, 'problem', '') or ''
        similar_tickets = getattr(request, 'similar_tickets', []) or []
        context = getattr(request, 'context', '') or ''

        similar_ctx = ""
        for t in similar_tickets[:5]:
            title = t.get('title', '')
            solution = t.get('solution', '')
            similar_ctx += f"- Resolved: {title}\n  Solution: {solution[:300]}\n\n"

        system_prompt = self._build_system_prompt(
            "solutions engineer",
            [
                "Recommend practical, safe solutions based on similar past incidents",
                "Return JSON with: recommended_solutions (array of {solution, steps, risk_level, estimated_effort}), primary_recommendation",
                "Risk levels: low, medium, high",
                "Include step-by-step implementation guidance",
                "Warn about potential pitfalls",
            ]
        )

        user_prompt = f"Problem: {problem}\nContext: {context}\n\nSimilar resolved tickets:\n{similar_ctx}\n\nRecommend solutions."

        result = await self.llm_client.chat_completion(
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            response_format={"type": "json_object"},
        )

        try:
            solutions = json.loads(result["content"])
        except json.JSONDecodeError:
            solutions = {
                "recommended_solutions": [{"solution": result["content"][:300], "risk_level": "medium"}],
                "primary_recommendation": result["content"][:200],
            }

        return {**solutions, "usage": result.get("usage")}

    async def summarize_ticket(self, request: Any) -> dict:
        """Generate ticket summary."""
        content = getattr(request, 'content', '') or ''
        title = getattr(request, 'title', '') or ''

        max_content_len = 12000
        if len(content) > max_content_len:
            content = content[:max_content_len] + "\n...[content truncated]"

        system_prompt = self._build_system_prompt(
            "technical summarizer",
            [
                "Summarize technical tickets concisely",
                "Return JSON with: summary (1-2 sentences), key_points (array), action_items (array), affected_services (array)",
                "Focus on: what is broken, impact, what needs to be done",
                "Extract specific action items and deadlines",
            ]
        )

        user_prompt = f"Title: {title}\n\nContent:\n{content}\n\nSummarize this ticket."

        result = await self.llm_client.chat_completion(
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            response_format={"type": "json_object"},
        )

        try:
            summary = json.loads(result["content"])
        except json.JSONDecodeError:
            summary = {
                "summary": result["content"][:200],
                "key_points": [],
                "action_items": [],
                "affected_services": [],
            }

        return {**summary, "usage": result.get("usage")}

    async def analyze_sentiment(self, request: Any) -> dict:
        """Analyze sentiment of ticket content."""
        content = getattr(request, 'content', '') or ''
        historical = getattr(request, 'historical', []) or []

        system_prompt = self._build_system_prompt(
            "sentiment analyst",
            [
                "Analyze sentiment in technical communication",
                "Return JSON with: overall_sentiment (positive/neutral/negative), confidence (0-1), emotions (array), urgency_level (low/medium/high)",
                "Consider: tone, word choice, punctuation, escalation patterns",
                "Technical frustration should be distinguished from interpersonal conflict",
            ]
        )

        hist_str = ""
        for h in historical[-5:]:
            ts = h.get('timestamp', '')
            text = h.get('content', '')[:200]
            hist_str += f"[{ts}] {text}\n"

        user_prompt = f"Content:\n{content[:3000]}\n\nHistory:\n{hist_str}\n\nAnalyze sentiment."

        result = await self.llm_client.chat_completion(
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            response_format={"type": "json_object"},
        )

        try:
            sentiment = json.loads(result["content"])
        except json.JSONDecodeError:
            sentiment = {
                "overall_sentiment": "neutral",
                "confidence": 0.5,
                "emotions": [],
                "urgency_level": "medium",
            }

        return {**sentiment, "usage": result.get("usage")}

    async def predict_sla(self, request: Any) -> dict:
        """Predict SLA breach probability."""
        ticket = getattr(request, 'ticket', {}) or {}
        sla_config = getattr(request, 'sla_config', {}) or {}
        elapsed_minutes = getattr(request, 'elapsed_minutes', 0) or 0

        sla_deadline = sla_config.get('response_minutes', 60) or 60
        resolution_minutes = sla_config.get('resolution_minutes', 240) or 240
        priority = ticket.get('priority', 'medium') or 'medium'

        priority_multipliers = {"critical": 0.5, "high": 0.7, "medium": 1.0, "low": 1.5}
        multiplier = priority_multipliers.get(priority, 1.0)

        response_risk = min(elapsed_minutes / (sla_deadline * multiplier), 1.0) if sla_deadline > 0 else 0
        resolution_risk = min(elapsed_minutes / (resolution_minutes * multiplier), 1.0) if resolution_minutes > 0 else 0

        system_prompt = self._build_system_prompt(
            "SLA risk analyst",
            [
                "Predict SLA breach probability based on ticket context",
                f"Current risks: response_risk={response_risk:.2f}, resolution_risk={resolution_risk:.2f}",
                "Return JSON with: breach_probability (0-100), risk_factors (array), recommended_actions (array), time_remaining_minutes",
                "Consider: complexity, assignee availability, historical patterns",
            ]
        )

        ticket_context = json.dumps(ticket, default=str)[:1000]
        user_prompt = f"Ticket: {ticket_context}\nSLA Config: {json.dumps(sla_config, default=str)}\nPredict SLA breach probability."

        result = await self.llm_client.chat_completion(
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            response_format={"type": "json_object"},
        )

        try:
            prediction = json.loads(result["content"])
        except json.JSONDecodeError:
            prediction = {
                "breach_probability": round(response_risk * 100),
                "risk_factors": ["Elevated based on time elapsed"],
                "recommended_actions": ["Escalate if no response within SLA window"],
                "time_remaining_minutes": max(0, int(sla_deadline - elapsed_minutes)),
            }

        return {**prediction, "usage": result.get("usage")}

    async def close(self):
        """Clean up resources."""
        await self.llm_client.close()
        logger.info("AIService closed")
