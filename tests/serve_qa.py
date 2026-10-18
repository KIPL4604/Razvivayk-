"""Loopback-only browser fixture with a separate database and a public test key."""
import os
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
os.chdir(ROOT)
os.environ.update({
    "TG_BOT_TOKEN": "teramont-poker-local-test",
    "GAME_DB_PATH": str(ROOT / "runtime" / "platform-qa.sqlite3"),
    "POKER_DB_PATH": str(ROOT / "runtime" / "platform-qa.sqlite3"),
    "DATABASE_URL": "",
    "REDIS_URL": "",
    "APP_URL": "http://127.0.0.1:8081",
})

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("webapp.backend.main:app", host="127.0.0.1", port=8081, ws_max_size=16384)
