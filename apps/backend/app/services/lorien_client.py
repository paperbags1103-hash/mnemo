from __future__ import annotations

import asyncio
import logging
import re
import sys
from pathlib import Path

from app.core.config import settings

_UUID_RE = re.compile(r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$", re.IGNORECASE)
logger = logging.getLogger(__name__)


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
            logger.info("lorien loaded from %s", db_path)
            return self._memory
        except Exception as exc:
            logger.warning("lorien unavailable: %s", exc)
            return None

    @staticmethod
    def _escape(value: str) -> str:
        return value.replace("\\", "\\\\").replace("'", "\\'")

    async def _run_query(self, query: str):
        loop = asyncio.get_running_loop()
        memory = await loop.run_in_executor(None, self._get_memory)
        if memory is None:
            return None
        return await loop.run_in_executor(None, lambda: list(memory.store.query(query)))

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
                lambda: memory.ingester.ingest_text(
                    text_clean,
                    source=f"mnemo:note:{note_id}",
                ),
            )
            return True
        except Exception as exc:
            raise RuntimeError(f"lorien ingest failed: {exc}") from exc

    def is_available(self) -> bool:
        return self._get_memory() is not None

    async def get_note_entities(self, note_id: str) -> list[dict]:
        """Get entities related to a note via source or source_ref."""
        if not _UUID_RE.match(note_id):
            return []

        safe_note_id = self._escape(note_id)
        rows = await self._run_query(
            "MATCH (e:Entity) "
            "OPTIONAL MATCH (f:Fact)-[:ABOUT]->(e) "
            f"WHERE e.status = 'active' AND ("
            f"e.source_ref CONTAINS '{safe_note_id}' OR "
            f"e.source CONTAINS '{safe_note_id}' OR "
            f"f.source_ref CONTAINS '{safe_note_id}' OR "
            f"f.source CONTAINS '{safe_note_id}') "
            "RETURN DISTINCT e.id, e.name, e.entity_type, e.confidence "
            "ORDER BY e.confidence DESC, e.name ASC"
        )
        if rows is None:
            return []

        return [
            {
                "id": row[0],
                "name": row[1],
                "entity_type": row[2] or "default",
                "confidence": float(row[3] or 0.0),
            }
            for row in rows
        ]

    async def get_note_facts(self, note_id: str) -> list[dict]:
        """Get facts related to a note via source or source_ref."""
        if not _UUID_RE.match(note_id):
            return []

        safe_note_id = self._escape(note_id)
        rows = await self._run_query(
            "MATCH (f:Fact) "
            "OPTIONAL MATCH (o:Entity) "
            "WHERE o.id = f.object_id "
            f"WITH f, o WHERE f.status = 'active' AND ("
            f"f.source_ref CONTAINS '{safe_note_id}' OR "
            f"f.source CONTAINS '{safe_note_id}') "
            "RETURN f.id, f.predicate, o.name, f.text, f.confidence "
            "ORDER BY f.confidence DESC, f.created_at DESC"
        )
        if rows is None:
            return []

        return [
            {
                "id": row[0],
                "predicate": row[1] or "related_to",
                "object_": row[2] or row[3] or "",
                "confidence": float(row[4] or 0.0),
            }
            for row in rows
        ]

    async def get_graph(self) -> dict[str, list[dict] | dict[str, int]]:
        rows = await self._run_query(
            "MATCH (e:Entity) WHERE e.status = 'active' "
            "RETURN e.id, e.name, e.entity_type"
        )
        if rows is None:
            return {"nodes": [], "edges": [], "stats": {"entities": 0, "facts": 0, "rules": 0}}

        fact_rows = await self._run_query(
            "MATCH (f:Fact)-[:ABOUT]->(e:Entity) WHERE e.status = 'active' "
            "RETURN e.id, count(f)"
        ) or []
        rule_rows = await self._run_query(
            "MATCH (e:Entity)-[:HAS_RULE]->(r:Rule) WHERE e.status = 'active' "
            "RETURN e.id, count(r)"
        ) or []
        edge_rows = await self._run_query(
            "MATCH (a:Entity)-[r:RELATED_TO]->(b:Entity) "
            "WHERE a.status = 'active' AND b.status = 'active' "
            "RETURN a.id, b.id, r.relation"
        ) or []

        fact_counts = {row[0]: int(row[1] or 0) for row in fact_rows}
        rule_counts = {row[0]: int(row[1] or 0) for row in rule_rows}
        nodes = [
            {
                "id": row[0],
                "label": row[1],
                "name": row[1],
                "entity_type": row[2] or "default",
                "fact_count": fact_counts.get(row[0], 0),
                "rule_count": rule_counts.get(row[0], 0),
            }
            for row in rows
        ]
        entity_ids = {node["id"] for node in nodes}
        edges = [
            {"from": row[0], "to": row[1], "label": row[2] or "", "relation": row[2] or ""}
            for row in edge_rows
            if row[0] in entity_ids and row[1] in entity_ids
        ]

        return {
            "nodes": nodes,
            "edges": edges,
            "stats": {
                "entities": len(nodes),
                "facts": sum(fact_counts.values()),
                "rules": sum(rule_counts.values()),
            },
        }


lorien_client = LorienClient()
