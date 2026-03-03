"""Debug: headers diagnostic"""
import json
import os as _os
import sys as _sys
_sys.path.insert(0, _os.path.dirname(_os.path.abspath(__file__)))
from http.server import BaseHTTPRequestHandler


class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        all_headers = dict(self.headers)
        env_key = _os.environ.get("MNEMO_API_KEY", "NOT_SET")
        received_key = self.headers.get("X-Api-Key") or self.headers.get("x-api-key") or "NOT_FOUND"
        body = json.dumps({
            "headers": all_headers,
            "env_MNEMO_API_KEY": env_key[:6] + "..." if env_key != "NOT_SET" else "NOT_SET",
            "received_api_key": received_key,
            "match": received_key == env_key,
        })
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(body.encode())
