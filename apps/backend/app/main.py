import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.v1 import graph, health, ingest, lorien, notes, search, tree, webhook
from app.core.config import settings
from app.core.db import db
from app.workers.ingest_worker import run_worker

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(_: FastAPI):
    await db.initialize()
    worker_task = asyncio.create_task(run_worker(interval_seconds=10))

    def on_worker_done(task: asyncio.Task) -> None:
        if not task.cancelled():
            exc = task.exception()
            if exc:
                logger.error("Ingest worker stopped unexpectedly: %s", exc)

    worker_task.add_done_callback(on_worker_done)
    yield
    worker_task.cancel()
    try:
        await worker_task
    except asyncio.CancelledError:
        pass


app = FastAPI(title=settings.app_name, lifespan=lifespan)


@app.middleware("http")
async def limit_body_size(request: Request, call_next):
    content_length = request.headers.get("content-length")
    if content_length:
        try:
            size = int(content_length)
        except ValueError:
            size = 0
        if size > 2_000_000:
            return JSONResponse(status_code=413, content={"detail": "Request too large"})
    return await call_next(request)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router)
app.include_router(notes.router, prefix=settings.api_v1_prefix)
app.include_router(tree.router, prefix=settings.api_v1_prefix)
app.include_router(search.router, prefix=settings.api_v1_prefix)
app.include_router(webhook.router, prefix=settings.api_v1_prefix)
app.include_router(ingest.router, prefix=settings.api_v1_prefix)
app.include_router(lorien.router, prefix=settings.api_v1_prefix)
app.include_router(graph.router, prefix=settings.api_v1_prefix)
