"""
Vercel Serverless Function — wraps the FastAPI app via ASGI.
All /api/v1/* requests are routed here by vercel.json rewrites.
"""
import sys
import os
from pathlib import Path

# Add backend to path
backend_src = Path(__file__).parent.parent / "apps" / "backend"
sys.path.insert(0, str(backend_src))

# lorien is unavailable on Vercel — env var will be unset
os.environ.setdefault("LORIEN_DB_PATH", "/tmp/lorien-unavailable")

from app.main import app  # noqa: E402  (FastAPI ASGI app)
