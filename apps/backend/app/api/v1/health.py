from fastapi import APIRouter

from app.core.db import db

router = APIRouter(prefix="/health", tags=["health"])


@router.get("/live")
async def health_live() -> dict[str, str]:
    return {"status": "ok"}


@router.get("/ready")
async def health_ready() -> dict[str, str]:
    readiness = await db.ready_status()
    return {"status": "ok", **readiness}
