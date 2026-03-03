"""GET /api/v1/tree."""

import json
from http.server import BaseHTTPRequestHandler

from _lib.db import close_conn, initialize, list_notes


class handler(BaseHTTPRequestHandler):
    def do_GET(self):
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
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()
