from fastapi import APIRouter

router = APIRouter(prefix="/ingest", tags=["ingest"])


@router.get("/jobs")
async def list_ingest_jobs() -> dict[str, list[object]]:
    return {"jobs": []}
