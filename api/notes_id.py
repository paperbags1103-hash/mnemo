"""GET/PATCH/DELETE /api/v1/notes/{id}."""

import json
import os as _os
import sys as _sys
_sys.path.insert(0, _os.path.dirname(_os.path.abspath(__file__)))
from http.server import BaseHTTPRequestHandler
from urllib.parse import parse_qs, urlparse

from _lib.auth import check_write_auth
from _lib.db import close_conn, delete_note, get_note, initialize, update_note
from _lib.models import NoteUpdate


class handler(BaseHTTPRequestHandler):
    def _note_id(self) -> str | None:
        params = parse_qs(urlparse(self.path).query)
        return params.get("note_id", [None])[0]

    def _write_json(self, status: int, payload) -> None:
        body = json.dumps(payload)
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(body.encode())

    def _write_empty(self, status: int) -> None:
        self.send_response(status)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()

    def do_GET(self):
        note_id = self._note_id()
        if not note_id:
            self._write_json(400, {"detail": "note_id is required"})
            return

        conn = initialize()
        try:
            note = get_note(conn, note_id)
        finally:
            close_conn(conn)

        if note is None:
            self._write_json(404, {"detail": "Note not found"})
            return

        self._write_json(200, note.model_dump(mode="json"))

    def do_PATCH(self):
        if not check_write_auth(self.headers):
            self._write_json(401, {"detail": "Unauthorized"})
            return
        note_id = self._note_id()
        if not note_id:
            self._write_json(400, {"detail": "note_id is required"})
            return

        length = int(self.headers.get("Content-Length", 0))
        raw = self.rfile.read(length)
        payload = NoteUpdate(**json.loads(raw or b"{}"))
        conn = initialize()
        try:
            try:
                note = update_note(conn, note_id, payload)
            except ValueError as exc:
                if str(exc) == "version_conflict":
                    self._write_json(409, {"detail": "Version conflict"})
                    return
                raise
        finally:
            close_conn(conn)

        if note is None:
            self._write_json(404, {"detail": "Note not found"})
            return

        self._write_json(200, note.model_dump(mode="json"))

    def do_DELETE(self):
        if not check_write_auth(self.headers):
            self._write_json(401, {"detail": "Unauthorized"})
            return
        note_id = self._note_id()
        if not note_id:
            self._write_json(400, {"detail": "note_id is required"})
            return

        conn = initialize()
        try:
            deleted = delete_note(conn, note_id)
        finally:
            close_conn(conn)

        if not deleted:
            self._write_json(404, {"detail": "Note not found"})
            return

        self._write_empty(204)

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, PATCH, DELETE, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, X-Api-Key, Authorization")
        self.end_headers()
