"""Load the project's private .env consistently for the API, bot and launcher."""
import os
from pathlib import Path

ROOT = Path(__file__).resolve().parent


def load_env() -> None:
    path = ROOT / '.env'
    if path.exists():
        for line in path.read_text(encoding='utf-8-sig').splitlines():
            line = line.strip()
            if line and not line.startswith('#') and '=' in line:
                key, value = line.split('=', 1)
                os.environ.setdefault(key.strip(), value.strip().strip('\"').strip("'"))
