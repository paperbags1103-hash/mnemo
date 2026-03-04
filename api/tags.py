"""GET /api/v1/tags - list all unique tags."""

import json
import os as _os
import sys as _sys
from http.server import BaseHTTPRequestHandler

_sys.path.insert(0, _os.path.dirname(_os.path.abspath(__file__)))

from _lib.db import close_conn, initialize


class handler(BaseHTTPRequestHandler):
    def _write_json(self, status, payload):
        body = json.dumps(payload)
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(body.encode())

    def do_GET(self):
        conn = initialize()
        try:
            rows = conn.execute("SELECT tags FROM note WHERE tags != '[]' AND tags IS NOT NULL").fetchall()
        finally:
            close_conn(conn)

        all_tags = set()
        for (tags_json,) in rows:
            try:
                tags = json.loads(tags_json)
                all_tags.update(tags)
            except Exception:
                pass

        self._write_json(200, {"tags": sorted(all_tags)})

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()
