"""Shared auth helpers."""
import os

MNEMO_API_KEY = os.environ.get("MNEMO_API_KEY", "").strip()
MNEMO_TOKEN = os.environ.get("MNEMO_TOKEN", "")


def check_auth(headers) -> bool:
    """Return True if request is authorized.
    
    HTTP/2 normalizes header names to lowercase, so we check both cases.
    If MNEMO_API_KEY is not set, all requests are allowed (dev mode).
    """
    if not MNEMO_API_KEY:
        return True
    received = headers.get("X-Api-Key") or headers.get("x-api-key") or ""
    return received == MNEMO_API_KEY


def check_write_auth(headers) -> bool:
    """Returns True if write access is allowed. GET requests skip this."""
    if not MNEMO_TOKEN:
        return True
    auth = headers.get("Authorization", "")
    return auth == f"Bearer {MNEMO_TOKEN}"
