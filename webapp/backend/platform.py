"""Account-scoped cloud saves, online lobby and an atomic FIFO match queue."""
from __future__ import annotations

import json
import re
import time
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from .auth import get_current_user
from .database import connection
from .registry import SAVE_GAMES, catalog

router = APIRouter(prefix="/api/platform", tags=["platform"])
QUEUE_TTL = 120
MAX_SAVE_BYTES = 128 * 1024
CHESS_LEVELS = {"beginner", "casual", "club", "expert", "master", "grandmaster"}


def _queue_connection(write=False):
    from . import poker
    # Legacy SQLite can keep poker in its own file. Queue + allocated room must
    # use that same transaction; PostgreSQL naturally shares the configured DB.
    return poker._connection(write)


def init_platform_db() -> None:
    with connection(write=True) as db:
        db.lock("schema:platform:saves:v1")
        db.executescript("""
            CREATE TABLE IF NOT EXISTS platform_saves (
                user_id BIGINT NOT NULL, game TEXT NOT NULL, revision BIGINT NOT NULL,
                state TEXT NOT NULL, updated_at BIGINT NOT NULL,
                PRIMARY KEY(user_id, game));
        """)
    with _queue_connection(write=True) as db:
        db.lock("schema:platform:queue:v1")
        db.executescript("""
            CREATE TABLE IF NOT EXISTS platform_matchmaking (
                user_id BIGINT NOT NULL, game TEXT NOT NULL, status TEXT NOT NULL,
                display_name TEXT NOT NULL, queued_at BIGINT NOT NULL,
                expires_at BIGINT NOT NULL, room_id TEXT,
                PRIMARY KEY(user_id, game));
            CREATE INDEX IF NOT EXISTS ix_platform_queue
                ON platform_matchmaking(game, status, queued_at);
            CREATE INDEX IF NOT EXISTS ix_platform_queue_expiry
                ON platform_matchmaking(expires_at);
        """)


def _notify(user_ids, payload=None) -> None:
    from .realtime import publish
    for user_id in set(user_ids):
        publish(f"user:{user_id}", payload or {"type": "lobby.changed"})


def _save_view(row) -> dict:
    return {"revision": row["revision"], "state": json.loads(row["state"]),
            "updatedAt": row["updated_at"]}


@router.get("/catalog")
def get_catalog() -> dict:
    return catalog()


@router.get("/saves")
def get_saves(user: dict = Depends(get_current_user)) -> dict:
    with connection() as db:
        rows = db.execute("SELECT * FROM platform_saves WHERE user_id=?", (user["id"],)).fetchall()
    return {"saves": {row["game"]: _save_view(row) for row in rows}}


class SaveRequest(BaseModel):
    revision: int = Field(ge=0, strict=True)
    state: dict


def _validate_save(game: str, state: dict) -> None:
    pending = [(state, 0)]
    while pending:
        value, depth = pending.pop()
        if depth > 24:
            raise HTTPException(422, "Сохранение содержит слишком много вложенных объектов")
        if isinstance(value, dict):
            if any(key in {"__proto__", "constructor", "prototype"} for key in value):
                raise HTTPException(422, "Некорректное поле сохранения")
            pending.extend((child, depth + 1) for child in value.values())
        elif isinstance(value, list):
            pending.extend((child, depth + 1) for child in value)
    if "run" not in state or (state["run"] is not None and not isinstance(state["run"], dict)):
        raise HTTPException(422, "Сохранение должно содержать объект партии run или null")
    run = state["run"]
    if run is None:
        return
    if game != "chess":
        if run.get("type") != game:
            raise HTTPException(422, "Тип сохранённой партии не совпадает с игрой")
        return
    if (not isinstance(run.get("id"), str) or not re.fullmatch(r"[A-Za-z0-9_-]{1,128}", run["id"])
            or run.get("side") not in ("w", "b")
            or not isinstance(run.get("level"), str) or run["level"] not in CHESS_LEVELS
            or not isinstance(run.get("moves"), list) or len(run["moves"]) > 2000
            or any(not isinstance(move, str) or not re.fullmatch(r"[a-h][1-8][a-h][1-8][qrbn]?", move)
                   for move in run["moves"])):
        raise HTTPException(422, "Некорректное сохранение шахматной партии")
    stats = state.get("stats", {})
    if not isinstance(stats, dict):
        raise HTTPException(422, "Некорректная шахматная статистика")
    for key, value in stats.items():
        if key not in {"wins", "losses", "draws"} or type(value) is not int or not 0 <= value <= 1_000_000_000:
            raise HTTPException(422, "Некорректная шахматная статистика")
    preferences = state.get("preferences", {})
    if (not isinstance(preferences, dict) or not isinstance(preferences.get("level", "casual"), str)
            or preferences.get("level", "casual") not in CHESS_LEVELS
            or preferences.get("side", "w") not in ("w", "b", "random")):
        raise HTTPException(422, "Некорректные настройки шахмат")


@router.put("/saves/{game}")
def put_save(game: str, payload: SaveRequest, user: dict = Depends(get_current_user)) -> dict:
    if game not in SAVE_GAMES:
        raise HTTPException(400, "Эта игра сохраняется сервером или отсутствует в каталоге")
    try:
        state = json.dumps(payload.state, ensure_ascii=False, allow_nan=False, separators=(",", ":"))
    except (ValueError, TypeError, RecursionError) as error:
        raise HTTPException(422, "Некорректное сохранение") from error
    if len(state.encode("utf-8")) > MAX_SAVE_BYTES:
        raise HTTPException(413, "Сохранение превышает 128 КБ")
    _validate_save(game, payload.state)
    now = int(time.time())
    with connection(write=True) as db:
        db.lock(f"save:{user['id']}:{game}")
        previous = db.execute("SELECT * FROM platform_saves WHERE user_id=? AND game=?",
                              (user["id"], game)).fetchone()
        revision = previous["revision"] if previous else 0
        if revision != payload.revision:
            raise HTTPException(409, {"message": "На другом устройстве уже есть более новое сохранение",
                                      "revision": revision, "save": _save_view(previous) if previous else None})
        revision += 1
        db.execute("""INSERT INTO platform_saves(user_id,game,revision,state,updated_at) VALUES (?,?,?,?,?)
            ON CONFLICT(user_id,game) DO UPDATE SET revision=excluded.revision,
                state=excluded.state,updated_at=excluded.updated_at""",
                   (user["id"], game, revision, state, now))
    _notify([user["id"]], {"type": "cloud.changed", "game": game, "revision": revision})
    return {"game": game, "revision": revision, "state": payload.state, "updatedAt": now}


def _match_view(row, now: int, db) -> dict:
    if not row or row["expires_at"] <= now:
        return {"status": "idle"}
    if row["status"] == "waiting":
        return {"status": "waiting", "expiresAt": row["expires_at"]}
    if row["status"] == "matched" and row["room_id"]:
        room = db.execute("SELECT payload FROM poker_rooms WHERE room_id=? AND expires_at>?",
                          (row["room_id"], now)).fetchone()
        if room and json.loads(room["payload"])["phase"] not in ("closed", "finished"):
            return {"status": "matched", "roomId": row["room_id"]}
    return {"status": "idle"}


@router.get("/lobby")
def get_lobby(user: dict = Depends(get_current_user)) -> dict:
    from . import poker
    with _queue_connection() as db:
        row = db.execute("SELECT * FROM platform_matchmaking WHERE user_id=? AND game='poker'",
                         (user["id"],)).fetchone()
        matchmaking = _match_view(row, int(time.time()), db)
    return {"rooms": poker.list_user_rooms(int(user["id"])), "matchmaking": matchmaking}


class MatchRequest(BaseModel):
    game: Literal["poker"] = "poker"


@router.post("/matchmaking")
def find_match(payload: MatchRequest, user: dict = Depends(get_current_user)) -> dict:
    from . import poker
    now = int(time.time())
    changed_users = [user["id"]]
    matched_room = None
    with _queue_connection(write=True) as db:
        db.lock("matchmaking:poker")
        own = db.execute("SELECT * FROM platform_matchmaking WHERE user_id=? AND game=?",
                         (user["id"], payload.game)).fetchone()
        current = _match_view(own, now, db)
        if current["status"] != "idle":
            return {"matchmaking": current}
        db.execute("DELETE FROM platform_matchmaking WHERE game=? AND expires_at<=?", (payload.game, now))
        last_ticket = db.execute("SELECT MAX(queued_at) FROM platform_matchmaking WHERE game=?",
                                 (payload.game,)).fetchone()[0] or 0
        ticket = max(int(time.time() * 1_000_000), last_ticket + 1)
        opponent = db.execute("""SELECT * FROM platform_matchmaking WHERE game=? AND status='waiting'
            AND expires_at>? AND user_id<>? ORDER BY queued_at,user_id LIMIT 1""",
                              (payload.game, now, user["id"])).fetchone()
        if opponent:
            matched_room = poker.create_match_room(
                {"id": opponent["user_id"], "first_name": opponent["display_name"]}, user, db)
            room_id = matched_room["roomId"]
            db.execute("""UPDATE platform_matchmaking SET status='matched',room_id=?,expires_at=?
                WHERE user_id=? AND game=?""", (room_id, now + poker.ROOM_TTL, opponent["user_id"], payload.game))
            status, expires_at = "matched", now + poker.ROOM_TTL
            changed_users.append(opponent["user_id"])
            result = {"status": "matched", "roomId": room_id}
        else:
            room_id = None
            status, expires_at = "waiting", now + QUEUE_TTL
            result = {"status": "waiting", "expiresAt": expires_at}
        db.execute("""INSERT INTO platform_matchmaking(user_id,game,status,display_name,queued_at,expires_at,room_id)
            VALUES (?,?,?,?,?,?,?) ON CONFLICT(user_id,game) DO UPDATE SET status=excluded.status,
                display_name=excluded.display_name,queued_at=excluded.queued_at,
                expires_at=excluded.expires_at,room_id=excluded.room_id""",
                   (user["id"], payload.game, status, str(user.get("first_name") or "Игрок")[:48], ticket, expires_at, room_id))
    # Room + both queue entries commit together; a crashed request cannot orphan
    # a paired player or expose a room that was rolled back.
    _notify(changed_users)
    if matched_room:
        from .realtime import publish
        publish(f"poker:{matched_room['roomId']}", {"version": matched_room["version"]})
    return {"matchmaking": result}


@router.delete("/matchmaking")
def cancel_match(user: dict = Depends(get_current_user)) -> dict:
    with _queue_connection(write=True) as db:
        db.lock("matchmaking:poker")
        # Once a match commits, cancellation must not silently close its table.
        db.execute("DELETE FROM platform_matchmaking WHERE user_id=? AND game='poker' AND status='waiting'",
                   (user["id"],))
        row = db.execute("SELECT * FROM platform_matchmaking WHERE user_id=? AND game='poker'",
                         (user["id"],)).fetchone()
        result = _match_view(row, int(time.time()), db)
    _notify([user["id"]])
    return {"matchmaking": result}


def expire_queue() -> None:
    now = int(time.time())
    with _queue_connection() as db:
        if not db.execute("SELECT user_id FROM platform_matchmaking WHERE expires_at<=? LIMIT 1", (now,)).fetchone():
            return
    with _queue_connection(write=True) as db:
        db.lock("matchmaking:poker")
        expired = db.execute("SELECT user_id FROM platform_matchmaking WHERE expires_at<=?", (now,)).fetchall()
        db.execute("DELETE FROM platform_matchmaking WHERE expires_at<=?", (now,))
    _notify([row["user_id"] for row in expired])
