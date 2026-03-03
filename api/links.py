"""GET /api/v1/notes/:noteId/links, POST /api/v1/links, DELETE /api/v1/links."""

import json
import os as _os
import sys as _sys

_sys.path.insert(0, _os.path.dirname(_os.path.abspath(__file__)))

from http.server import BaseHTTPRequestHandler
from urllib.parse import parse_qs, urlparse

from _lib.auth import check_write_auth
from _lib.db import close_conn, create_link, delete_link, get_links, initialize


class handler(BaseHTTPRequestHandler):
    def _write_json(self, status: int, payload) -> None:
        body = json.dumps(payload)
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(body.encode())

    def do_GET(self):
        params = parse_qs(urlparse(self.path).query)
        note_id = params.get("note_id", [None])[0]
        if not note_id:
            self._write_json(400, {"detail": "note_id required"})
            return
        conn = initialize()
        try:
            links = get_links(conn, note_id)
        finally:
            close_conn(conn)
        self._write_json(200, links)

    def do_POST(self):
        if not check_write_auth(self.headers):
            self._write_json(401, {"detail": "Unauthorized"})
            return
        length = int(self.headers.get("Content-Length", 0))
        raw = self.rfile.read(length)
        data = json.loads(raw or b"{}")
        source_id = data.get("source_id")
        target_id = data.get("target_id")
        link_type = data.get("link_type", "manual")
        if not source_id or not target_id:
            self._write_json(400, {"detail": "source_id and target_id required"})
            return
        conn = initialize()
        try:
            create_link(conn, source_id, target_id, link_type)
        finally:
            close_conn(conn)
        self._write_json(201, {"source_id": source_id, "target_id": target_id, "link_type": link_type})

    def do_DELETE(self):
        if not check_write_auth(self.headers):
            self._write_json(401, {"detail": "Unauthorized"})
            return
        params = parse_qs(urlparse(self.path).query)
        source_id = params.get("source_id", [None])[0]
        target_id = params.get("target_id", [None])[0]
        if not source_id or not target_id:
            self._write_json(400, {"detail": "source_id and target_id required"})
            return
        conn = initialize()
        try:
            delete_link(conn, source_id, target_id)
        finally:
            close_conn(conn)
        self._write_json(204, {})

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")
        self.end_headers()
