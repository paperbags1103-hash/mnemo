from uuid import UUID

from fastapi import APIRouter, HTTPException, Response, status

from app.core.db import db
from app.models.note import Note, NoteCreate, NoteUpdate

router = APIRouter(prefix="/notes", tags=["notes"])


@router.post("", response_model=Note, status_code=status.HTTP_201_CREATED)
async def create_note(payload: NoteCreate) -> Note:
    return await db.create_note(payload)


@router.get("", response_model=list[Note])
async def list_notes() -> list[Note]:
    return await db.list_notes()


@router.get("/{note_id}", response_model=Note)
async def get_note(note_id: UUID) -> Note:
    note = await db.get_note(note_id)
    if note is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Note not found")
    return note


@router.patch("/{note_id}", response_model=Note)
async def update_note(note_id: UUID, payload: NoteUpdate) -> Note:
    note = await db.update_note(note_id, payload)
    if note is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Note not found")
    return note


@router.delete("/{note_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_note(note_id: UUID) -> Response:
    deleted = await db.delete_note(note_id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Note not found")
    return Response(status_code=status.HTTP_204_NO_CONTENT)
