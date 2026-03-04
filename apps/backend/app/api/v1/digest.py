from datetime import datetime, timezone
from fastapi import APIRouter, Query
from app.core.db import db

router = APIRouter(prefix="/digest", tags=["digest"])


@router.get("")
async def get_digest(
    hours: int = Query(default=24, ge=1, le=720),
    limit: int = Query(default=30, ge=1, le=100),
):
    raw = await db.get_digest(hours=hours, limit=limit)

    # Group by source (치레, manual, etc.) for frontend
    source_map: dict[str, list] = {}
    for note in raw["notes"]:
        src = note.get("source") or "manual"
        source_map.setdefault(src, []).append(note)

    groups = [{"source": src, "notes": notes} for src, notes in source_map.items()]

    # since = hours ago from now
    since = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")

    return {
        "since": since,
        "groups": groups,
        "by_category": raw["by_category"],
        "total": raw["total"],
    }
