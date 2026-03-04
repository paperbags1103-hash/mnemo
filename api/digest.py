"""GET /api/v1/digest - last 24h notes grouped by source."""

import json
import os as _os
import sys as _sys
from datetime import datetime, timedelta, timezone
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
        since = (datetime.now(timezone.utc) - timedelta(hours=24)).isoformat()
        conn = initialize()
        try:
            rows = conn.execute(
                """
                SELECT id, title, content, source, created_at, updated_at
                FROM note
                WHERE created_at >= ?
                ORDER BY datetime(created_at) DESC
                """,
                (since,),
            ).fetchall()
        finally:
            close_conn(conn)

        groups = {}
        for row in rows:
            note_id, title, content, source, created_at, updated_at = row
            del updated_at
            group_source = source or "human"
            groups.setdefault(group_source, []).append(
                {
                    "id": note_id,
                    "title": title,
                    "content": content[:200] + "..." if content and len(content) > 200 else content,
                    "created_at": created_at,
                }
            )

        self._write_json(
            200,
            {
                "since": since,
                "groups": [{"source": source, "notes": notes} for source, notes in groups.items()],
                "total": len(rows),
            },
        )

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()
