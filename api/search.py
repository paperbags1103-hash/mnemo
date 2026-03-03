"""GET /api/v1/search?q=...&limit=..."""

import json
from http.server import BaseHTTPRequestHandler
from urllib.parse import parse_qs, urlparse

from _lib.db import close_conn, initialize, list_notes, search_notes


class handler(BaseHTTPRequestHandler):
    def do_GET(self):
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
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()
