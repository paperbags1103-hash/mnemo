"""GET /health/live and /health/ready."""

import json
import os as _os
import sys as _sys
_sys.path.insert(0, _os.path.dirname(_os.path.abspath(__file__)))
from http.server import BaseHTTPRequestHandler
from urllib.parse import parse_qs, urlparse

from _lib.config import MNEMO_API_KEY, is_turso


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
        params = parse_qs(urlparse(self.path).query)
        check = params.get("check", ["live"])[0]
        body = json.dumps(
            {
                "status": "ok",
                "check": check,
                "storage": "turso" if is_turso() else "sqlite-ephemeral",
                "warning": None
                if is_turso()
                else "TURSO_URL not set - data is ephemeral on Vercel",
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
