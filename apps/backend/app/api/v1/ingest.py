from uuid import UUID

from fastapi import APIRouter, HTTPException, Query, status

from app.core.db import db
from app.models.ingest_job import IngestJob

router = APIRouter(prefix="/ingest", tags=["ingest"])


@router.get("/jobs")
async def list_ingest_jobs(
    note_id: str | None = Query(default=None),
    status: str | None = Query(default=None),
    limit: int = Query(default=20, ge=1, le=100),
) -> dict[str, list[IngestJob]]:
    jobs = await db.list_jobs(note_id=note_id, status=status, limit=limit)
    return {"jobs": jobs}


@router.post("/jobs/{job_id}/retry", response_model=IngestJob, status_code=status.HTTP_200_OK)
async def retry_ingest_job(job_id: UUID) -> IngestJob:
    job = await db.get_job(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="Job not found")
    if job.status != "failed":
        raise HTTPException(status_code=400, detail="Only failed jobs can be retried")

    retried_job = await db.retry_job(job_id)
    if retried_job is None:
        raise HTTPException(status_code=404, detail="Job not found")
    return retried_job
