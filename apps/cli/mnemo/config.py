import json
from pathlib import Path

DEFAULT_API_URL = "http://localhost:8000"
CONFIG_PATH = Path.home() / ".mnemo" / "config.json"


def get_config() -> dict:
    if CONFIG_PATH.exists():
        return json.loads(CONFIG_PATH.read_text())
    return {"api_url": DEFAULT_API_URL}


def set_config(key: str, value: str) -> None:
    CONFIG_PATH.parent.mkdir(parents=True, exist_ok=True)
    config = get_config()
    config[key] = value
    CONFIG_PATH.write_text(json.dumps(config, indent=2))


def get_api_url() -> str:
    return get_config().get("api_url", DEFAULT_API_URL)
