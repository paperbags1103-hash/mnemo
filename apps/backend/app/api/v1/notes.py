import logging
from uuid import UUID

from fastapi import APIRouter, HTTPException, Response, status

from app.core.db import db
from app.models.note import NoteCreate, NoteRead, NoteUpdate

router = APIRouter(prefix="/notes", tags=["notes"])
logger = logging.getLogger(__name__)


@router.post("", response_model=NoteRead, status_code=status.HTTP_201_CREATED)
async def create_note(payload: NoteCreate) -> NoteRead:
    note = await db.create_note(payload)
    try:
        await db.enqueue_ingest(str(note.id))
    except Exception as exc:
        logger.warning("Failed to enqueue ingest for note %s: %s", note.id, exc)
    return note


@router.get("", response_model=list[NoteRead])
async def list_notes() -> list[NoteRead]:
    return await db.list_notes()


@router.get("/{note_id}", response_model=NoteRead)
async def get_note(note_id: UUID) -> NoteRead:
    note = await db.get_note(note_id)
    if note is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Note not found")
    return note


@router.patch("/{note_id}", response_model=NoteRead)
async def update_note(note_id: UUID, payload: NoteUpdate) -> NoteRead:
    try:
        note = await db.update_note(note_id, payload)
    except ValueError as exc:
        if str(exc) == "version_conflict":
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Version conflict") from exc
        raise
    if note is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Note not found")
    try:
        await db.enqueue_ingest(str(note.id))
    except Exception as exc:
        logger.warning("Failed to enqueue ingest for note %s: %s", note.id, exc)
    return note


@router.delete("/{note_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_note(note_id: UUID) -> Response:
    deleted = await db.delete_note(note_id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Note not found")
    return Response(status_code=status.HTTP_204_NO_CONTENT)
