"""
Vercel Serverless Function — wraps FastAPI via Mangum (ASGI adapter).
All /api/v1/* and /api/* requests are routed here by vercel.json rewrites.
"""
import sys
import os
from pathlib import Path

# Add backend to Python path
backend_src = Path(__file__).parent.parent / "apps" / "backend"
sys.path.insert(0, str(backend_src))

# Vercel has no lorien — set dummy path so graceful degradation kicks in
os.environ.setdefault("LORIEN_DB_PATH", "/tmp/lorien-unavailable")
# Use /tmp for SQLite when no Turso is configured
os.environ.setdefault("SQLITE_PATH", "/tmp/mnemo.db")

from app.main import app  # noqa: E402  FastAPI ASGI app
from mangum import Mangum  # noqa: E402

# Mangum wraps FastAPI for AWS Lambda / Vercel Serverless
handler = Mangum(app, lifespan="auto")
