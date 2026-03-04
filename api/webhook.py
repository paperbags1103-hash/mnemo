"""POST /api/v1/webhooks/save."""

import json
import os as _os
import sys as _sys
_sys.path.insert(0, _os.path.dirname(_os.path.abspath(__file__)))
from http.server import BaseHTTPRequestHandler

from _lib.auth import check_write_auth
from _lib.db import close_conn, create_note, initialize, upsert_note
from _lib.models import NoteCreate


class handler(BaseHTTPRequestHandler):
    def _write_json(self, status, payload):
        body = json.dumps(payload)
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(body.encode())

    def do_POST(self):
        if not check_write_auth(self.headers):
            self._write_json(401, {"detail": "Unauthorized"})
            return

        length = int(self.headers.get("Content-Length", 0))
        data = json.loads(self.rfile.read(length) or b"{}")
        title = data.get("title", "Untitled")
        content = data.get("content", "")
        source = data.get("source", "human")
        tags = data.get("tags", [])
        do_upsert = data.get("upsert", False)
        payload = NoteCreate(title=title, content=content, tags=tags, source=source)

        conn = initialize()
        try:
            if do_upsert:
                note, _created = upsert_note(conn, payload)
            else:
                note = create_note(conn, payload)
        finally:
            close_conn(conn)

        self._write_json(201, note.model_dump(mode="json"))

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, X-Api-Key, Authorization")
        self.end_headers()
