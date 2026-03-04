"""POST /api/v1/webhooks/save - external agents push notes directly."""

import logging

from fastapi import APIRouter, Depends, status
from pydantic import BaseModel, Field

from app.core.auth import verify_api_key
from app.core.db import db
from app.models.note import NoteCreate, NoteRead

router = APIRouter(prefix="/webhooks", tags=["webhooks"], dependencies=[Depends(verify_api_key)])
logger = logging.getLogger(__name__)


class WebhookPayload(BaseModel):
    title: str = "Untitled"
    content: str = ""
    tags: list[str] = Field(default_factory=list)
    source: str = ""
    source_ref: str = Field(default="", description="Origin URL, book title, or other reference")
    upsert: bool = False


@router.post("/save", response_model=NoteRead, status_code=status.HTTP_201_CREATED)
async def webhook_save(payload: WebhookPayload) -> NoteRead:
    content = payload.content
    if payload.source:
        content = f"**Source:** {payload.source}\n\n{content}"

    note_payload = NoteCreate(
        title=payload.title,
        content=content,
        folder_id=None,
        tags=payload.tags,
        source_ref=payload.source_ref or None,
    )

    if payload.upsert:
        note, _created = await db.upsert_note(note_payload)
    else:
        note = await db.create_note(note_payload)

    try:
        await db.enqueue_ingest(str(note.id))
    except Exception as exc:
        logger.warning("Failed to enqueue ingest for note %s: %s", note.id, exc)

    return note
