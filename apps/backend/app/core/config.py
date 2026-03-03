from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "mnemo"
    api_v1_prefix: str = "/api/v1"
    turso_url: str | None = None
    turso_auth_token: str | None = None
    sqlite_path: str = ".data/mnemo.db"
    lorien_db_path: str = "~/.openclaw/workspace/.lorien/db"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    @property
    def resolved_sqlite_path(self) -> Path:
        return Path(self.sqlite_path).expanduser()

    @property
    def resolved_lorien_db_path(self) -> Path:
        return Path(self.lorien_db_path).expanduser()


settings = Settings()
