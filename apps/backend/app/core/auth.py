from fastapi import Header, HTTPException, status

from app.core.config import settings


async def verify_api_key(x_api_key: str | None = Header(default=None)) -> None:
    """If MNEMO_API_KEY is set, require it in X-Api-Key header."""
    if not settings.mnemo_api_key:
        return
    if x_api_key != settings.mnemo_api_key:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or missing API key. Set X-Api-Key header.",
        )
