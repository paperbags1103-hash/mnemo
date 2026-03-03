from __future__ import annotations

import asyncio
import logging

from app.core.db import db
from app.services.lorien_client import lorien_client

logger = logging.getLogger(__name__)


async def process_pending_jobs() -> None:
    """Process up to 5 pending ingest jobs."""
    jobs = await db.get_pending_jobs(limit=5)
    for job in jobs:
        await db.mark_job_processing(job.id)
        try:
            note = await db.get_note(job.note_id)
            if note is None:
                await db.mark_job_done(job.id)
                continue

            success = await lorien_client.ingest_note(
                note_id=str(note.id),
                title=note.title,
                content=note.content,
            )
            if success:
                await db.mark_job_done(job.id)
                logger.info("Ingested note %s", note.id)
            else:
                await db.mark_job_failed(job.id, "lorien unavailable")
        except Exception as exc:
            logger.warning("Ingest job %s failed: %s", job.id, exc)
            await db.mark_job_failed(job.id, str(exc))


async def run_worker(interval_seconds: int = 10) -> None:
    """Background worker loop."""
    while True:
        try:
            await process_pending_jobs()
        except Exception as exc:
            logger.error("Worker error: %s", exc)
        await asyncio.sleep(interval_seconds)
