"""GET /api/v1/tree."""

import json
import os as _os
import sys as _sys
_sys.path.insert(0, _os.path.dirname(_os.path.abspath(__file__)))
import os
from http.server import BaseHTTPRequestHandler

from _lib.db import close_conn, initialize, list_notes

MNEMO_API_KEY = os.environ.get("MNEMO_API_KEY", "")


def _check_auth(headers) -> bool:
    return _check_auth_fn(headers)


class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        if not _check_auth(self.headers):
            self.send_response(401)
            self.send_header("Content-Type", "application/json")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            self.wfile.write(json.dumps({"detail": "Invalid or missing API key"}).encode())
            return
        conn = initialize()
        try:
            notes = list_notes(conn)
        finally:
            close_conn(conn)

        body = json.dumps(
            {
                "items": [
                    {
                        "id": str(note.id),
                        "title": note.title,
                        "folder_id": note.folder_id,
                    }
                    for note in notes
                ]
            }
        )
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(body.encode())

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, X-Api-Key")
        self.end_headers()
