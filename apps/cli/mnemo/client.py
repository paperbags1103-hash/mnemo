import os
from pathlib import Path
from typing import Any

import httpx

from .config import get_api_url


class MnemoClient:
    def __init__(self) -> None:
        self.base_url = get_api_url().rstrip("/")
        self.api_key = os.environ.get("MNEMO_API_KEY", "")

    def _headers(self) -> dict[str, str]:
        if not self.api_key:
            return {}
        return {"X-Api-Key": self.api_key}

    def list_notes(self, limit: int = 20) -> list[dict[str, Any]]:
        response = httpx.get(f"{self.base_url}/api/v1/notes", headers=self._headers(), timeout=10)
        response.raise_for_status()
        notes = response.json()
        return notes[:limit]

    def get_note(self, note_id: str) -> dict[str, Any]:
        response = httpx.get(
            f"{self.base_url}/api/v1/notes/{note_id}",
            headers=self._headers(),
            timeout=10,
        )
        response.raise_for_status()
        return response.json()

    def create_note(self, title: str, content: str) -> dict[str, Any]:
        response = httpx.post(
            f"{self.base_url}/api/v1/notes",
            json={"title": title, "content": content},
            headers=self._headers(),
            timeout=10,
        )
        response.raise_for_status()
        return response.json()

    def upsert_note(self, title: str, content: str) -> dict[str, Any]:
        """Create or update note by title (idempotent)."""
        response = httpx.put(
            f"{self.base_url}/api/v1/notes",
            json={"title": title, "content": content},
            headers=self._headers(),
            timeout=10,
        )
        response.raise_for_status()
        return response.json()

    def webhook_save(
        self,
        title: str,
        content: str,
        source: str = "",
        upsert: bool = False,
        tags: list[str] | None = None,
    ) -> dict[str, Any]:
        response = httpx.post(
            f"{self.base_url}/api/v1/webhooks/save",
            json={
                "title": title,
                "content": content,
                "source": source,
                "upsert": upsert,
                "tags": tags or [],
            },
            headers=self._headers(),
            timeout=10,
        )
        response.raise_for_status()
        return response.json()

    def search_notes(self, query: str, limit: int = 10) -> list[dict[str, Any]]:
        response = httpx.get(
            f"{self.base_url}/api/v1/search",
            params={"q": query, "limit": limit},
            headers=self._headers(),
            timeout=10,
        )
        response.raise_for_status()
        payload = response.json()
        if isinstance(payload, dict):
            results = payload.get("results", [])
        else:
            results = payload
        return results[:limit]

    def ingest_file(self, path: str) -> dict[str, Any]:
        file_path = Path(path).expanduser()
        content = file_path.read_text(encoding="utf-8")
        title = file_path.stem
        return self.create_note(title=title, content=content)

    def delete_note(self, note_id: str) -> bool:
        response = httpx.delete(
            f"{self.base_url}/api/v1/notes/{note_id}",
            headers=self._headers(),
            timeout=10,
        )
        if response.status_code == 404:
            return False
        response.raise_for_status()
        return response.status_code == 204
