"""
Enrichment job queue — no LLM in backend.
AI agent polls pending jobs and does the actual extraction.

Endpoints:
  POST /api/v1/notes/{id}/request-enrich   → mark note as pending
  GET  /api/v1/notes/enrichment/pending    → list pending notes (for AI agent)
  POST /api/v1/notes/{id}/enrichment       → AI agent submits result (updates note)
"""

import re
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from app.core.auth import verify_api_key
from app.core.db import db
from app.models.note import NoteUpdate

router = APIRouter(tags=["enrich"])


def strip_html(html: str) -> str:
    return re.sub(r"<[^>]+>", " ", html).strip()


class EnrichResult(BaseModel):
    title: str
    summary: str
    category: str
    tags: list[str]


@router.post("/notes/{note_id}/request-enrich")
async def request_enrich(note_id: str):
    """User clicks ✨ AI button → marks note as pending for AI agent to process."""
    note = await db.get_note(note_id)
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")
    raw = strip_html(note.content)
    if len(raw) < 10:
        raise HTTPException(status_code=422, detail="Content too short")
    await db.request_enrichment(note_id)
    return {"ok": True, "status": "pending"}


@router.get("/notes/enrichment/pending")
async def list_pending(limit: int = 10):
    """AI agent polls this endpoint during heartbeat to find notes needing enrichment."""
    pending = await db.list_pending_enrichments(limit=limit)
    # Strip HTML from content for LLM consumption
    for item in pending:
        item["content_text"] = strip_html(item["content"])[:3000]
    return {"pending": pending, "count": len(pending)}


@router.post("/notes/{note_id}/enrichment", dependencies=[Depends(verify_api_key)])
async def submit_enrichment(note_id: str, result: EnrichResult):
    """AI agent submits enrichment result → updates note title/tags/content."""
    note = await db.get_note(note_id)
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")

    # Prepend blockquote summary
    if result.summary:
        enriched_content = f"<blockquote><p>{result.summary}</p></blockquote><hr>{note.content}"
    else:
        enriched_content = note.content

    existing_non_cat = [t for t in note.tags if not t.startswith("cat:")]
    all_tags = [f"cat:{result.category}"] + list(
        dict.fromkeys(result.tags + existing_non_cat)
    )[:12]

    await db.update_note(note_id, NoteUpdate(
        title=result.title[:100],
        content=enriched_content,
        tags=all_tags,
    ))
    await db.set_enrichment_status(note_id, "done")

    return {"ok": True, "title": result.title, "category": result.category}
