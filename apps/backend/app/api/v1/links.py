from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from app.core.auth import verify_api_key
from app.core.db import db

router = APIRouter(prefix="/links", tags=["links"])


class LinkCreate(BaseModel):
    source_id: str
    target_id: str
    link_type: str = "manual"
    confidence: float = 1.0
    rationale: str | None = None
    status: str = "confirmed"  # confirmed | pending | rejected


class LinkStatusUpdate(BaseModel):
    status: str  # confirmed | rejected


@router.post("", dependencies=[Depends(verify_api_key)])
async def create_link(payload: LinkCreate):
    await db.create_link(
        source_id=payload.source_id,
        target_id=payload.target_id,
        link_type=payload.link_type,
        confidence=payload.confidence,
        rationale=payload.rationale,
        status=payload.status,
    )
    return {"ok": True}


@router.get("/pending")
async def list_pending_links():
    return await db.get_pending_links()


@router.get("/{note_id}/backlinks")
async def get_backlinks(note_id: str):
    return await db.get_backlinks(note_id)


@router.patch("/{source_id}/{target_id}", dependencies=[Depends(verify_api_key)])
async def update_link_status(source_id: str, target_id: str, payload: LinkStatusUpdate):
    if payload.status not in ("confirmed", "rejected"):
        raise HTTPException(status_code=400, detail="status must be confirmed or rejected")
    updated = await db.update_link_status(source_id, target_id, payload.status)
    if not updated:
        raise HTTPException(status_code=404, detail="link not found")
    return {"ok": True, "status": payload.status}
