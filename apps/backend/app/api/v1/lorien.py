from fastapi import APIRouter

router = APIRouter(prefix="/lorien", tags=["lorien"])


@router.post("/ingest/note")
async def ingest_note() -> dict[str, str]:
    return {"status": "queued"}
