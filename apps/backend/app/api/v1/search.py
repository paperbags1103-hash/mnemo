from fastapi import APIRouter, Depends

from app.core.auth import verify_api_key
from app.core.db import db

router = APIRouter(prefix="/search", tags=["search"], dependencies=[Depends(verify_api_key)])


@router.get("")
async def search_notes(q: str = "", limit: int = 10) -> dict[str, str | list[dict]]:
    """Search notes by title and content."""
    if not q.strip():
        notes = await db.list_notes()
        return {"query": q, "results": [note.model_dump(mode="json") for note in notes[:limit]]}

    results = await db.search_notes(q, limit=limit)
    return {"query": q, "results": [note.model_dump(mode="json") for note in results]}
