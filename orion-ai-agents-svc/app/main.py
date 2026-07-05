"""Orion AI Agents Service - FastAPI application entry point."""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from opentelemetry import trace
from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
from opentelemetry.sdk.resources import Resource
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from opentelemetry.sdk.trace.export.in_memory_span_exporter import InMemorySpanExporter

from app.config import get_settings
from app.repositories.agent_repo import close_db, init_db

logger = logging.getLogger("orion-ai-agents-svc")


def setup_otel(app: FastAPI) -> None:
    """Configure OpenTelemetry tracing."""
    resource = Resource.create({"service.name": "orion-ai-agents-svc"})
    provider = TracerProvider(resource=resource)
    exporter = InMemorySpanExporter()
    provider.add_span_processor(BatchSpanProcessor(exporter))
    trace.set_tracer_provider(provider)
    FastAPIInstrumentor.instrument_app(app)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan: startup and shutdown hooks."""
    settings = get_settings()
    await init_db(settings)
    logger.info("AI Agents Service started on port %d", settings.port)
    yield
    await close_db()
    logger.info("AI Agents Service shut down")


def create_app() -> FastAPI:
    """Create and configure the FastAPI application."""
    app = FastAPI(
        title="Orion AI Agents Service",
        version="1.0.0",
        description="Manage AI Agents, tool calls, and execution history",
        lifespan=lifespan,
    )

    setup_otel(app)

    from app.api.agent_routes import router as agent_router

    app.include_router(agent_router)

    @app.get("/healthz")
    async def health_check():
        return {"status": "ok", "service": "orion-ai-agents-svc"}

    return app


app = create_app()
