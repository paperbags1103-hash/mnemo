"""Debug: what does self.path look like in Vercel?"""
import json
import os as _os
import sys as _sys
_sys.path.insert(0, _os.path.dirname(_os.path.abspath(__file__)))
from http.server import BaseHTTPRequestHandler
from urllib.parse import parse_qs, urlparse


class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        parsed = urlparse(self.path)
        params = parse_qs(parsed.query)
        body = json.dumps({
            "self_path": self.path,
            "parsed_path": parsed.path,
            "parsed_query": parsed.query,
            "params": params,
            "env_path": _os.environ.get("PATH_INFO", ""),
            "env_query": _os.environ.get("QUERY_STRING", ""),
        })
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(body.encode())
