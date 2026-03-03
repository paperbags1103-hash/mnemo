from __future__ import annotations

import logging

from fastapi import APIRouter

from app.services.lorien_client import lorien_client

router = APIRouter(prefix="/lorien", tags=["lorien"])
logger = logging.getLogger(__name__)


@router.post("/ingest/note")
async def ingest_note() -> dict[str, str]:
    return {"status": "queued"}


@router.get("/notes/{note_id}/entities")
async def get_note_entities(note_id: str) -> dict[str, list[dict]]:
    try:
        entities = await lorien_client.get_note_entities(note_id)
    except Exception as exc:
        logger.warning("Failed to load note entities for %s: %s", note_id, exc)
        entities = []
    return {"entities": entities}


@router.get("/notes/{note_id}/facts")
async def get_note_facts(note_id: str) -> dict[str, list[dict]]:
    try:
        facts = await lorien_client.get_note_facts(note_id)
    except Exception as exc:
        logger.warning("Failed to load note facts for %s: %s", note_id, exc)
        facts = []
    return {"facts": facts}


@router.get("/graph")
async def get_graph() -> dict[str, list[dict] | dict[str, int]]:
    try:
        return await lorien_client.get_graph()
    except Exception as exc:
        logger.warning("Failed to load graph data: %s", exc)
        return {"nodes": [], "edges": [], "stats": {"entities": 0, "facts": 0, "rules": 0}}
