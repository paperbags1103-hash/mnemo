from __future__ import annotations

import asyncio
import re
import sys
from pathlib import Path

from app.core.config import settings


class LorienClient:
    def __init__(self) -> None:
        self._memory = None

    def _get_memory(self):
        """Lazy-load lorien. Returns None if unavailable."""
        if self._memory is not None:
            return self._memory

        try:
            lorien_src = Path("~/Documents/lorien/src").expanduser()
            if lorien_src.exists() and str(lorien_src) not in sys.path:
                sys.path.insert(0, str(lorien_src))

            from lorien import LorienMemory

            db_path = settings.resolved_lorien_db_path
            db_path.parent.mkdir(parents=True, exist_ok=True)
            self._memory = LorienMemory(str(db_path))
            return self._memory
        except Exception:
            return None

    async def ingest_note(self, note_id: str, title: str, content: str) -> bool:
        """Ingest a note into lorien. Returns True on success, False on failure."""
        try:
            loop = asyncio.get_running_loop()
            memory = await loop.run_in_executor(None, self._get_memory)
            if memory is None:
                return False

            text = f"# {title}\n\n{content}" if title else content
            text_clean = re.sub(r"<[^>]+>", "", text)
            text_clean = re.sub(r"\s+", " ", text_clean).strip()

            if not text_clean or len(text_clean) < 10:
                return True

            await loop.run_in_executor(
                None,
                lambda: memory.ingest_text(
                    text_clean,
                    source=f"mnemo:note:{note_id}",
                    keyword_only=True,
                ),
            )
            return True
        except Exception as exc:
            raise RuntimeError(f"lorien ingest failed: {exc}") from exc

    def is_available(self) -> bool:
        return self._get_memory() is not None


lorien_client = LorienClient()
