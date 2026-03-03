from pathlib import Path
from typing import Any

import httpx

from .config import get_api_url


class MnemoClient:
    def __init__(self) -> None:
        self.base_url = get_api_url().rstrip("/")

    def list_notes(self, limit: int = 20) -> list[dict[str, Any]]:
        response = httpx.get(f"{self.base_url}/api/v1/notes", timeout=10)
        response.raise_for_status()
        notes = response.json()
        return notes[:limit]

    def get_note(self, note_id: str) -> dict[str, Any]:
        response = httpx.get(f"{self.base_url}/api/v1/notes/{note_id}", timeout=10)
        response.raise_for_status()
        return response.json()

    def create_note(self, title: str, content: str) -> dict[str, Any]:
        response = httpx.post(
            f"{self.base_url}/api/v1/notes",
            json={"title": title, "content": content},
            timeout=10,
        )
        response.raise_for_status()
        return response.json()

    def search_notes(self, query: str, limit: int = 10) -> list[dict[str, Any]]:
        response = httpx.get(
            f"{self.base_url}/api/v1/search",
            params={"q": query, "limit": limit},
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
        response = httpx.delete(f"{self.base_url}/api/v1/notes/{note_id}", timeout=10)
        if response.status_code == 404:
            return False
        response.raise_for_status()
        return response.status_code == 204
