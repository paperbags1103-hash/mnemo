"""GET /api/v1/notes and POST /api/v1/notes."""

import json
from http.server import BaseHTTPRequestHandler

from _lib.db import close_conn, create_note, initialize, list_notes
from _lib.models import NoteCreate


class handler(BaseHTTPRequestHandler):
    def _write_json(self, status: int, payload) -> None:
        body = json.dumps(payload)
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(body.encode())

    def do_GET(self):
        conn = initialize()
        try:
            notes = list_notes(conn)
        finally:
            close_conn(conn)
        self._write_json(200, [note.model_dump(mode="json") for note in notes])

    def do_POST(self):
        length = int(self.headers.get("Content-Length", 0))
        raw = self.rfile.read(length)
        payload = NoteCreate(**json.loads(raw or b"{}"))
        conn = initialize()
        try:
            note = create_note(conn, payload)
        finally:
            close_conn(conn)
        self._write_json(201, note.model_dump(mode="json"))

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()
