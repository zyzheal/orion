"""Orion Intelligence Service - Entry Point"""
import os
from datetime import datetime

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from src.api.classify import router as classify_router
from src.api.code_review import router as code_review_router
from src.api.predict_sla import router as predict_sla_router
from src.api.root_cause import router as root_cause_router
from src.api.sentiment import router as sentiment_router
from src.api.solution import router as solution_router
from src.api.summarize import router as summarize_router
from api.routes import router as base_router

app = FastAPI(title="Orion Intelligence Service")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Health & Readiness
# ---------------------------------------------------------------------------

@app.get("/api/v1/health")
async def health():
    """Liveness probe -- returns healthy status with current timestamp."""
    return {
        "status": "healthy",
        "service": "orion-intelligence-svc",
        "timestamp": datetime.now().isoformat(),
    }


@app.get("/api/v1/ready")
async def readiness():
    """Readiness probe -- indicates the service is ready to serve traffic."""
    return {
        "status": "ready",
        "service": "orion-intelligence-svc",
        "timestamp": datetime.now().isoformat(),
    }


# ---------------------------------------------------------------------------
# Base API Routers
# ---------------------------------------------------------------------------

app.include_router(base_router, prefix="/api/v1", tags=["base"])


# ---------------------------------------------------------------------------
# AI API Routers (mounted under /api/v1/ai)
# ---------------------------------------------------------------------------

app.include_router(classify_router, prefix="/api/v1/ai", tags=["classify"])
app.include_router(summarize_router, prefix="/api/v1/ai", tags=["summarize"])
app.include_router(sentiment_router, prefix="/api/v1/ai", tags=["sentiment"])
app.include_router(code_review_router, prefix="/api/v1/ai", tags=["code-review"])
app.include_router(root_cause_router, prefix="/api/v1/ai", tags=["root-cause"])
app.include_router(solution_router, prefix="/api/v1/ai", tags=["solution"])
app.include_router(predict_sla_router, prefix="/api/v1/ai", tags=["predict-sla"])


if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", "3006"))
    uvicorn.run(app, host="0.0.0.0", port=port)