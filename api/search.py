"""GET /api/v1/search?q=...&limit=..."""

import json
import os as _os
import sys as _sys
_sys.path.insert(0, _os.path.dirname(_os.path.abspath(__file__)))
import os
from http.server import BaseHTTPRequestHandler
from urllib.parse import parse_qs, urlparse

from _lib.db import close_conn, initialize, list_notes, search_notes

MNEMO_API_KEY = os.environ.get("MNEMO_API_KEY", "")


def _check_auth(headers) -> bool:
    if not MNEMO_API_KEY:
        return True
    return headers.get("X-Api-Key") == MNEMO_API_KEY


class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        if not _check_auth(self.headers):
            self.send_response(401)
            self.send_header("Content-Type", "application/json")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            self.wfile.write(json.dumps({"detail": "Invalid or missing API key"}).encode())
            return
        params = parse_qs(urlparse(self.path).query)
        query = params.get("q", [""])[0]
        limit = int(params.get("limit", ["10"])[0])

        conn = initialize()
        try:
            if query.strip():
                results = search_notes(conn, query, limit=limit)
            else:
                results = list_notes(conn)[:limit]
        finally:
            close_conn(conn)

        body = json.dumps(
            {"query": query, "results": [note.model_dump(mode="json") for note in results]}
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
