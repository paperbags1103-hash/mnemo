"""Debug: test pydantic import"""
import json
from http.server import BaseHTTPRequestHandler

class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        errors = []
        try:
            import pydantic
            pydantic_ok = pydantic.__version__
        except Exception as e:
            pydantic_ok = None
            errors.append(f"pydantic: {e}")
        try:
            import libsql_experimental
            libsql_ok = True
        except Exception as e:
            libsql_ok = False
            errors.append(f"libsql_experimental: {e}")
        try:
            import sys, os
            sys.path.insert(0, os.path.dirname(__file__))
            from _lib.config import is_turso
            config_ok = True
        except Exception as e:
            config_ok = False
            errors.append(f"_lib.config: {e}")

        body = json.dumps({
            "pydantic": pydantic_ok,
            "libsql_experimental": libsql_ok,
            "config": config_ok,
            "errors": errors,
        })
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(body.encode())
