"""GET /api/v1/notes and POST /api/v1/notes."""

import json
import os as _os
import sys as _sys
_sys.path.insert(0, _os.path.dirname(_os.path.abspath(__file__)))
from http.server import BaseHTTPRequestHandler

from _lib.db import close_conn, create_note, initialize, list_notes, upsert_note
from _lib.models import NoteCreate
from _lib.auth import check_write_auth


class handler(BaseHTTPRequestHandler):
    def _write_json(self, status: int, payload) -> None:
        body = json.dumps(payload)
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(body.encode())

    def do_GET(self):
        try:
            conn = initialize()
            try:
                notes = list_notes(conn)
            finally:
                close_conn(conn)
            self._write_json(200, [note.model_dump(mode="json") for note in notes])
        except Exception as exc:
            import traceback
            self._write_json(500, {"error": str(exc), "trace": traceback.format_exc()[-500:]})

    def do_POST(self):
        if not check_write_auth(self.headers):
            self._write_json(401, {"detail": "Unauthorized"})
            return
        length = int(self.headers.get("Content-Length", 0))
        raw = self.rfile.read(length)
        payload = NoteCreate(**json.loads(raw or b"{}"))
        conn = initialize()
        try:
            note = create_note(conn, payload)
        finally:
            close_conn(conn)
        self._write_json(201, note.model_dump(mode="json"))

    def do_PUT(self):
        if not check_write_auth(self.headers):
            self._write_json(401, {"detail": "Unauthorized"})
            return
        length = int(self.headers.get("Content-Length", 0))
        raw = self.rfile.read(length)
        payload = NoteCreate(**json.loads(raw or b"{}"))
        conn = initialize()
        try:
            note, _created = upsert_note(conn, payload)
        finally:
            close_conn(conn)
        self._write_json(200, note.model_dump(mode="json"))

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, PUT, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, X-Api-Key, Authorization")
        self.end_headers()
