import os

TURSO_URL = os.environ.get("TURSO_URL", "")
TURSO_AUTH_TOKEN = os.environ.get("TURSO_AUTH_TOKEN", "")
MNEMO_API_KEY = os.environ.get("MNEMO_API_KEY", "")

# Vercel only allows writes under /tmp, so local sqlite is ephemeral there.
SQLITE_PATH = os.environ.get("SQLITE_PATH", "/tmp/mnemo.db")


def is_turso() -> bool:
    return bool(TURSO_URL)
