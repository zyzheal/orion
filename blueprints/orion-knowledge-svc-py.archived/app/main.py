"""Knowledge Service entry point."""

from fastapi import FastAPI

from .routers import knowledge

app = FastAPI(title="Orion Knowledge Service", version="0.1.0")
app.include_router(knowledge.router)


@app.get("/healthz")
async def healthz():
    return {"status": "ok"}
