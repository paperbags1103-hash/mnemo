"""
Vercel Serverless Function — exposes FastAPI ASGI app directly.
Vercel detects the `app` variable and runs it as an ASGI handler.
"""
import sys
import os
from pathlib import Path

# Add backend to Python path
backend_src = Path(__file__).parent.parent / "apps" / "backend"
sys.path.insert(0, str(backend_src))

# Defaults for Vercel environment
os.environ.setdefault("LORIEN_DB_PATH", "/tmp/lorien-unavailable")
os.environ.setdefault("SQLITE_PATH", "/tmp/mnemo.db")

from app.main import app  # noqa: E402  FastAPI ASGI app — Vercel detects `app`
