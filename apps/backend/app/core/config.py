from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "mnemo"
    api_v1_prefix: str = "/api/v1"
    cors_origins: list[str] = ["http://localhost:5173", "http://localhost:4173"]
    turso_url: str | None = None
    turso_auth_token: str | None = None
    sqlite_path: str = "sqlite:///./mnemo.db"
    lorien_db_path: str = "~/.openclaw/workspace/.lorien/db"
    mnemo_api_key: str = Field(default="", env="MNEMO_API_KEY")
    groq_api_key: str = Field(default="", env="GROQ_API_KEY")

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    @property
    def resolved_sqlite_path(self) -> Path:
        raw_path = self.sqlite_path.removeprefix("sqlite:///")
        path = Path(raw_path).expanduser()
        if path.is_absolute():
            return path
        backend_dir = Path(__file__).resolve().parents[2]
        return (backend_dir / path).resolve()

    @property
    def resolved_lorien_db_path(self) -> Path:
        return Path(self.lorien_db_path).expanduser()


settings = Settings()
