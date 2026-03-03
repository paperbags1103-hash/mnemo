"""GET /api/v1/notes and POST /api/v1/notes."""

import json
import os
from http.server import BaseHTTPRequestHandler

from _lib.db import close_conn, create_note, initialize, list_notes, upsert_note
from _lib.models import NoteCreate

MNEMO_API_KEY = os.environ.get("MNEMO_API_KEY", "")


def _check_auth(headers) -> bool:
    if not MNEMO_API_KEY:
        return True
    return headers.get("X-Api-Key") == MNEMO_API_KEY


class handler(BaseHTTPRequestHandler):
    def _write_json(self, status: int, payload) -> None:
        body = json.dumps(payload)
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(body.encode())

    def do_GET(self):
        if not _check_auth(self.headers):
            self._write_json(401, {"detail": "Invalid or missing API key"})
            return
        conn = initialize()
        try:
            notes = list_notes(conn)
        finally:
            close_conn(conn)
        self._write_json(200, [note.model_dump(mode="json") for note in notes])

    def do_POST(self):
        if not _check_auth(self.headers):
            self._write_json(401, {"detail": "Invalid or missing API key"})
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
        if not _check_auth(self.headers):
            self._write_json(401, {"detail": "Invalid or missing API key"})
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
        self.send_header("Access-Control-Allow-Headers", "Content-Type, X-Api-Key")
        self.end_headers()
