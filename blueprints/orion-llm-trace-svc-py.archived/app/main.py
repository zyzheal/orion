"""LLM Trace Service entry point."""

from fastapi import FastAPI

from .routers import traces

app = FastAPI(title="Orion LLM Trace Service", version="0.1.0")
app.include_router(traces.router)


@app.get("/healthz")
async def healthz():
    return {"status": "ok"}
