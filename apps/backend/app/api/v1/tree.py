from fastapi import APIRouter

from app.core.db import db

router = APIRouter(prefix="/tree", tags=["tree"])


@router.get("")
async def get_tree() -> dict[str, list[dict[str, str | None]]]:
    notes = await db.list_notes()
    return {
        "items": [
            {
                "id": str(note.id),
                "title": note.title,
                "folder_id": note.folder_id,
            }
            for note in notes
        ]
    }
