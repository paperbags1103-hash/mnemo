import logging
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Response, status

from app.core.auth import verify_api_key
from app.core.db import db
from app.models.note import NoteCreate, NoteRead, NoteUpdate, apply_category_tag, extract_category

router = APIRouter(prefix="/notes", tags=["notes"], dependencies=[Depends(verify_api_key)])
logger = logging.getLogger(__name__)


def normalize_create_payload(payload: NoteCreate) -> NoteCreate:
    category = payload.category if payload.category is not None else extract_category(payload.tags)
    return NoteCreate(
        title=payload.title,
        content=payload.content,
        folder_id=payload.folder_id,
        tags=apply_category_tag(payload.tags, category),
        category=category,
        source_ref=payload.source_ref,
    )


async def normalize_update_payload(note_id: UUID, payload: NoteUpdate) -> NoteUpdate | None:
    updates = payload.model_dump(exclude_unset=True)
    category = updates.pop("category", None)
    if category is None:
        return payload

    current = await db.get_note(note_id)
    if current is None:
        return None

    tags = updates.get("tags", current.tags)
    updates["tags"] = apply_category_tag(tags, category)
    return NoteUpdate(**updates)


@router.post("", response_model=NoteRead, status_code=status.HTTP_201_CREATED)
async def create_note(payload: NoteCreate) -> NoteRead:
    note = await db.create_note(normalize_create_payload(payload))
    try:
        await db.enqueue_ingest(str(note.id))
    except Exception as exc:
        logger.warning("Failed to enqueue ingest for note %s: %s", note.id, exc)
    return note


@router.put("", response_model=NoteRead)
async def upsert_note(payload: NoteCreate) -> NoteRead:
    """Create note or update if title already exists."""
    note, _created = await db.upsert_note(normalize_create_payload(payload))
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
    normalized_payload = await normalize_update_payload(note_id, payload)
    if normalized_payload is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Note not found")

    try:
        note = await db.update_note(note_id, normalized_payload)
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
