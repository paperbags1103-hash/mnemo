from fastapi import APIRouter

from app.core.db import db
from app.services.lorien_client import lorien_client

router = APIRouter(prefix="/health", tags=["health"])


@router.get("/live")
async def health_live() -> dict[str, str]:
    return {"status": "ok"}


@router.get("/ready")
async def health_ready() -> dict[str, object]:
    readiness = await db.ready_status()
    pending_count = len(await db.get_pending_jobs(limit=100))
    return {
        "status": "ok",
        **readiness,
        "lorien_available": lorien_client.is_available(),
        "ingest_queue_depth": pending_count,
    }
