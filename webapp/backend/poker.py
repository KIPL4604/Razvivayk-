"""Authoritative, persisted heads-up Texas Hold'em with public-information coaching.

All chips are free training chips. A raise amount is the player's TOTAL bet on
the current street, not the increment. Private cards/deck never leave a player
view, and the bot and equity estimator receive only their own and public cards.
"""
from __future__ import annotations

from collections import Counter
import hashlib
from itertools import combinations
import json
import os
from pathlib import Path
import random
import secrets
import time
from typing import Literal
import uuid

from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel, Field

from .auth import get_current_user, verify_init_data
from .database import connection

router = APIRouter(prefix="/api/poker", tags=["poker"])
RANKS = "23456789TJQKA"
DECK = tuple(rank + suit for rank in RANKS for suit in "shdc")
HAND_NAMES = ("Старшая карта", "Пара", "Две пары", "Тройка", "Стрит", "Флеш", "Фулл-хаус", "Каре", "Стрит-флеш")
SMALL_BLIND, BIG_BLIND, START_STACK = 10, 20, 1000
ROOM_TTL = 72 * 3600
MAX_ROOMS = 2000
TURN_SECONDS = 120
WAITING_SECONDS = 600


class PokerRuleError(ValueError):
    """An illegal action; no state is committed."""


def _straight(ranks: set[int]) -> int:
    if 14 in ranks:
        ranks = ranks | {1}
    for top in range(14, 4, -1):
        if all(value in ranks for value in range(top - 4, top + 1)):
            return top
    return 0


def evaluate(cards: list[str] | tuple[str, ...]) -> tuple[int, ...]:
    """Comparable rank of the best five cards out of five, six or seven."""
    if not 5 <= len(cards) <= 7:
        raise ValueError("Нужны 5–7 карт")
    values = [RANKS.index(card[0]) + 2 for card in cards]
    counts = Counter(values)
    ordered = sorted(counts, reverse=True)
    suits: dict[str, list[int]] = {}
    for card, value in zip(cards, values):
        suits.setdefault(card[1], []).append(value)
    flush = next((sorted(v, reverse=True) for v in suits.values() if len(v) >= 5), [])
    if flush and (top := _straight(set(flush))):
        return (8, top)
    quads = [value for value in ordered if counts[value] == 4]
    if quads:
        return (7, quads[0], next(value for value in ordered if value != quads[0]))
    trips = [value for value in ordered if counts[value] >= 3]
    if trips:
        pairs = [value for value in ordered if value != trips[0] and counts[value] >= 2]
        if pairs:
            return (6, trips[0], pairs[0])
    if flush:
        return (5, *flush[:5])
    if top := _straight(set(ordered)):
        return (4, top)
    if trips:
        return (3, trips[0], *[v for v in ordered if v != trips[0]][:2])
    pairs = [value for value in ordered if counts[value] >= 2]
    if len(pairs) >= 2:
        return (2, *pairs[:2], next(v for v in ordered if v not in pairs[:2]))
    if pairs:
        return (1, pairs[0], *[v for v in ordered if v != pairs[0]][:3])
    return (0, *ordered[:5])


def best_five(cards: list[str]) -> list[str]:
    return list(max(combinations(cards, 5), key=evaluate))


def estimate_equity(hole: list[str], board: list[str], samples: int = 400, rng=None) -> float:
    """Uniform unknown-opponent Monte Carlo, including half credit for ties.

    Deliberately has no room/deck/opponent parameter: unseen real cards are not
    excluded. The estimate assumes a random opponent range, not perfect play.
    """
    rng = rng or random.SystemRandom()
    known = set(hole + board)
    unseen = [card for card in DECK if card not in known]
    wins = 0.0
    for _ in range(samples):
        draw = rng.sample(unseen, 2 + 5 - len(board))
        community = board + draw[2:]
        own, other = evaluate(hole + community), evaluate(draw[:2] + community)
        wins += 1 if own > other else 0.5 if own == other else 0
    return wins / samples


def _name(value: object) -> str:
    return " ".join(str(value or "Игрок").split())[:48] or "Игрок"


def _player(identity: str, name: str, bot: bool = False) -> dict:
    return {"identity": identity, "name": _name(name), "stack": START_STACK, "bet": 0,
            "committed": 0, "hole": [], "folded": False, "isBot": bot}


def _log(room: dict, text: str) -> None:
    room["log"] = (room["log"] + [text])[-32:]


def _new_room(mode: str, owner: dict) -> dict:
    return {"roomId": uuid.uuid4().hex, "code": "".join(secrets.choice("ABCDEFGHJKLMNPQRSTUVWXYZ23456789") for _ in range(6)),
            "mode": mode, "version": 1, "phase": "waiting", "street": "preflop", "handNumber": 0,
            "dealerIndex": 0, "turnIndex": None, "players": [owner], "board": [], "deck": [],
            "burned": [], "currentBet": 0, "lastRaise": BIG_BLIND, "acted": [], "ready": [],
            "result": None, "log": [], "tokenHash": None,
            "turnDeadline": None, "waitingExpiresAt": int(time.time()) + WAITING_SECONDS if mode == "online" else None}


def _refresh_deadlines(room: dict) -> None:
    """An online player's existing turn is the reconnect grace period."""
    room["turnDeadline"] = int(time.time()) + TURN_SECONDS if room["mode"] == "online" and room["phase"] == "playing" else None
    if room["phase"] != "waiting":
        room["waitingExpiresAt"] = None


def _pay(room: dict, seat: int, amount: int) -> None:
    player = room["players"][seat]
    amount = min(amount, player["stack"])
    player["stack"] -= amount
    player["bet"] += amount
    player["committed"] += amount


def _refund_uncalled(room: dict) -> None:
    first, second = room["players"]
    difference = first["committed"] - second["committed"]
    if difference:
        high = first if difference > 0 else second
        refund = abs(difference)
        high["stack"] += refund
        high["committed"] -= refund
        high["bet"] = max(0, high["bet"] - refund)
        _log(room, f"{high['name']}: возврат неуравненной ставки {refund}")


def _finish(room: dict, folded: int | None = None) -> None:
    _refund_uncalled(room)
    players = room["players"]
    pot = sum(p["committed"] for p in players)
    if folded is not None:
        winners = [1 - folded]
        reason = "fold"
    else:
        ranks = [evaluate(p["hole"] + room["board"]) for p in players]
        winners = [seat for seat, rank in enumerate(ranks) if rank == max(ranks)]
        reason = "showdown"
    awards = []
    # Any odd chip goes to the first seat left of the dealer, standard Hold'em.
    award_order = sorted(winners, key=lambda seat: (seat - room["dealerIndex"] - 1) % 2)
    for index, seat in enumerate(award_order):
        amount = pot // len(winners) + int(index < pot % len(winners))
        players[seat]["stack"] += amount
        cards = best_five(players[seat]["hole"] + room["board"]) if reason == "showdown" else []
        awards.append({"seat": seat, "amount": amount,
                       "handName": HAND_NAMES[evaluate(cards)[0]] if cards else None, "hand": cards})
    message = "Банк разделён" if len(winners) > 1 else f"{players[winners[0]]['name']} выигрывает {pot}"
    room["result"] = {"reason": reason, "pot": pot, "winners": awards, "message": message}
    for player in players:
        player["committed"] = 0
        player["bet"] = 0
    room.update(phase="finished" if any(p["stack"] == 0 for p in players) else "complete",
                street="showdown", turnIndex=None, currentBet=0, ready=[])
    _log(room, message)


def _deal_street(room: dict) -> None:
    room["burned"].append(room["deck"].pop())
    count = 3 if room["street"] == "preflop" else 1
    room["board"].extend(room["deck"].pop() for _ in range(count))
    room["street"] = {"preflop": "flop", "flop": "turn", "turn": "river"}[room["street"]]
    room.update(currentBet=0, lastRaise=BIG_BLIND, acted=[], turnIndex=1 - room["dealerIndex"])
    for player in room["players"]:
        player["bet"] = 0
    _log(room, {"flop": "Флоп", "turn": "Тёрн", "river": "Ривер"}[room["street"]])


def _runout(room: dict) -> None:
    _refund_uncalled(room)
    while len(room["board"]) < 5:
        _deal_street(room)
    _finish(room)


def _advance(room: dict, previous: int | None = None) -> None:
    players = room["players"]
    if any(p["folded"] for p in players):
        _finish(room, next(i for i, p in enumerate(players) if p["folded"]))
        return
    if any(p["stack"] == 0 for p in players):
        active = next((i for i, p in enumerate(players) if p["stack"] > 0), None)
        if active is None or players[active]["bet"] >= room["currentBet"]:
            _runout(room)
        else:
            room["turnIndex"] = active
        return
    if len(room["acted"]) == 2 and players[0]["bet"] == players[1]["bet"]:
        if room["street"] == "river":
            _finish(room)
        else:
            _deal_street(room)
        return
    if previous is not None:
        room["turnIndex"] = 1 - previous


def _start_hand(room: dict) -> None:
    if room["handNumber"]:
        room["dealerIndex"] = 1 - room["dealerIndex"]
    room["handNumber"] += 1
    room.update(phase="playing", street="preflop", board=[], burned=[], currentBet=0,
                lastRaise=BIG_BLIND, acted=[], ready=[], result=None)
    room["deck"] = list(DECK)
    secrets.SystemRandom().shuffle(room["deck"])
    for player in room["players"]:
        player.update(hole=[], bet=0, committed=0, folded=False)
    # Deal clockwise, one card at a time, starting left of the dealer.
    for _ in range(2):
        for seat in (1 - room["dealerIndex"], room["dealerIndex"]):
            room["players"][seat]["hole"].append(room["deck"].pop())
    _pay(room, room["dealerIndex"], SMALL_BLIND)
    _pay(room, 1 - room["dealerIndex"], BIG_BLIND)
    room["currentBet"] = max(p["bet"] for p in room["players"])
    room["turnIndex"] = room["dealerIndex"]
    _log(room, f"Раздача {room['handNumber']} · блайнды {SMALL_BLIND}/{BIG_BLIND}")
    _advance(room)
    _refresh_deadlines(room)


def legal_actions(room: dict, seat: int) -> list[str]:
    actions = ["leave"] if room["phase"] != "closed" else []
    if room["phase"] == "complete" and seat not in room["ready"]:
        return ["next", *actions]
    if room["phase"] != "playing" or room["turnIndex"] != seat:
        return actions
    player, other = room["players"][seat], room["players"][1 - seat]
    owe = room["currentBet"] - player["bet"]
    actions = ["fold", "call" if owe > 0 else "check", *actions]
    if other["stack"] > 0 and player["stack"] > owe and seat not in room["acted"]:
        actions.insert(2, "raise")
    return actions


def apply_action(room: dict, seat: int, action: str, amount: int | None = None) -> None:
    if action not in legal_actions(room, seat):
        raise PokerRuleError("Сейчас этот ход недоступен")
    player = room["players"][seat]
    if action == "leave":
        if room["phase"] == "playing":
            player["folded"] = True
            _finish(room, seat)
        room.update(phase="closed", turnIndex=None)
        _log(room, f"{player['name']} покинул стол")
        return
    if action == "next":
        room["ready"].append(seat)
        for index, opponent in enumerate(room["players"]):
            if opponent["isBot"] and index not in room["ready"]:
                room["ready"].append(index)
        if len(room["ready"]) == 2:
            _start_hand(room)
        return
    if action == "fold":
        player["folded"] = True
        _log(room, f"{player['name']}: пас")
    elif action == "check":
        _log(room, f"{player['name']}: чек")
    elif action == "call":
        paid = min(player["stack"], room["currentBet"] - player["bet"])
        _pay(room, seat, paid)
        _log(room, f"{player['name']}: колл {paid}")
    elif action == "raise":
        maximum = player["bet"] + player["stack"]
        minimum = room["currentBet"] + room["lastRaise"]
        if not isinstance(amount, int) or isinstance(amount, bool) or amount <= room["currentBet"] or amount > maximum:
            raise PokerRuleError("Укажи полную ставку в пределах своего стека")
        if amount < minimum and amount != maximum:
            raise PokerRuleError(f"Минимальная полная ставка: {minimum}; меньшая возможна только олл-ин")
        increment = amount - room["currentBet"]
        _pay(room, seat, amount - player["bet"])
        room["currentBet"] = amount
        if increment >= room["lastRaise"]:
            room["lastRaise"] = increment
            room["acted"] = []
        _log(room, f"{player['name']}: {'олл-ин' if player['stack'] == 0 else 'ставка'} {amount}")
    if seat not in room["acted"]:
        room["acted"].append(seat)
    _advance(room, seat)


def _pot_numbers(room: dict, seat: int) -> tuple[int, int, float]:
    player = room["players"][seat]
    call = min(player["stack"], max(0, room["currentBet"] - player["bet"]))
    pot = sum(p["committed"] for p in room["players"])
    if len(room["players"]) == 2:
        other = room["players"][1 - seat]
        # Excess opponent chips cannot be won by a short stack.
        pot -= max(0, other["committed"] - player["committed"] - call)
    odds = call / (pot + call) if call else 0.0
    return pot, call, odds


def _bot_turn(room: dict) -> None:
    for _ in range(12):
        seat = room["turnIndex"]
        if room["phase"] != "playing" or seat is None or not room["players"][seat]["isBot"]:
            return
        player = room["players"][seat]
        actions = legal_actions(room, seat)
        equity = estimate_equity(player["hole"], room["board"], 100)
        pot, call, odds = _pot_numbers(room, seat)
        if call and equity + 0.06 < odds:
            apply_action(room, seat, "fold")
        elif "raise" in actions and equity > 0.67 and secrets.randbelow(100) < 45:
            maximum = player["bet"] + player["stack"]
            minimum = room["currentBet"] + room["lastRaise"]
            target = min(maximum, max(minimum, room["currentBet"] + max(BIG_BLIND, pot // 2)))
            apply_action(room, seat, "raise", target)
        else:
            apply_action(room, seat, "call" if call else "check")
    raise RuntimeError("Bot action loop exceeded the maximum possible streets")


def player_view(room: dict, seat: int) -> dict:
    actions = legal_actions(room, seat)
    player = room["players"][seat]
    pot, call, _ = _pot_numbers(room, seat)
    reveal = room["result"] is not None and room["result"]["reason"] == "showdown"
    players = [{"seat": index, "name": p["name"], "stack": p["stack"], "bet": p["bet"],
                "committed": p["committed"], "hole": p["hole"][:] if index == seat or reveal else [None] * len(p["hole"]),
                "folded": p["folded"], "allIn": p["stack"] == 0, "isBot": p["isBot"], "isYou": index == seat}
               for index, p in enumerate(room["players"])]
    return {key: room[key] for key in ("roomId", "code", "mode", "version", "phase", "street", "handNumber",
            "dealerIndex", "turnIndex", "currentBet", "board", "result", "ready", "log")} | {
                "players": players, "youIndex": seat, "pot": sum(p["committed"] for p in room["players"]),
                "toCall": call, "minRaiseTo": min(room["currentBet"] + room["lastRaise"], player["bet"] + player["stack"]) if "raise" in actions else None,
                "maxRaiseTo": player["bet"] + player["stack"], "legalActions": actions,
                "turnDeadline": room.get("turnDeadline"), "waitingExpiresAt": room.get("waitingExpiresAt"),
                "smallBlind": SMALL_BLIND, "bigBlind": BIG_BLIND, "trainingChips": True}


def _db_path() -> Path:
    return Path(os.getenv("POKER_DB_PATH") or os.getenv("GAME_DB_PATH", "runtime/teramont.sqlite3")).resolve()


def _connection(write: bool = False):
    # The legacy separate poker file is kept for SQLite installations. A
    # configured PostgreSQL deployment stores all game modules together.
    path = _db_path() if os.getenv("POKER_DB_PATH") and not os.getenv("DATABASE_URL") else None
    return connection(write=write, path=path)


def init_poker_db() -> None:
    with _connection(True) as db:
        db.execute("""CREATE TABLE IF NOT EXISTS poker_rooms (
            room_id TEXT PRIMARY KEY, code TEXT NOT NULL UNIQUE,
            payload TEXT NOT NULL, expires_at INTEGER NOT NULL,
            version INTEGER NOT NULL DEFAULT 1, phase TEXT NOT NULL DEFAULT 'waiting',
            turn_deadline INTEGER, waiting_expires_at INTEGER)""")
        columns = db.columns("poker_rooms")
        needs_backfill = not {"version", "phase", "turn_deadline", "waiting_expires_at"}.issubset(columns) or not db.columns("poker_room_members")
        for name, declaration in (("version", "INTEGER NOT NULL DEFAULT 1"),
                                  ("phase", "TEXT NOT NULL DEFAULT 'waiting'"),
                                  ("turn_deadline", "INTEGER"), ("waiting_expires_at", "INTEGER")):
            if name not in columns:
                db.execute(f"ALTER TABLE poker_rooms ADD COLUMN {name} {declaration}")
        db.execute("""CREATE TABLE IF NOT EXISTS poker_room_members (
            room_id TEXT NOT NULL REFERENCES poker_rooms(room_id) ON DELETE CASCADE,
            user_id INTEGER NOT NULL, PRIMARY KEY(room_id,user_id))""")
        db.execute("CREATE INDEX IF NOT EXISTS ix_poker_expiry ON poker_rooms(expires_at)")
        db.execute("CREATE INDEX IF NOT EXISTS ix_poker_deadlines ON poker_rooms(phase,turn_deadline,waiting_expires_at)")
        db.execute("CREATE INDEX IF NOT EXISTS ix_poker_members_user ON poker_room_members(user_id)")
        db.execute("DELETE FROM poker_rooms WHERE expires_at < ?", (int(time.time()),))
        # Only the one-time schema migration scans legacy rooms. Startup must
        # neither rewrite unchanged payloads nor extend their storage lifetime.
        if needs_backfill:
            for row in db.execute("SELECT room_id,payload FROM poker_rooms").fetchall():
                room = json.loads(row["payload"])
                if "turnDeadline" not in room:
                    _refresh_deadlines(room)
                if "waitingExpiresAt" not in room:
                    room["waitingExpiresAt"] = int(time.time()) + WAITING_SECONDS if room["mode"] == "online" and room["phase"] == "waiting" else None
                db.execute("""UPDATE poker_rooms SET payload=?,version=?,phase=?,turn_deadline=?,waiting_expires_at=? WHERE room_id=?""",
                           (json.dumps(room, ensure_ascii=False), room["version"], room["phase"],
                            room.get("turnDeadline"), room.get("waitingExpiresAt"), row["room_id"]))
                _save_members(db, room)


def _save(db, room: dict, expected_version: int | None = None) -> None:
    """Persist with compare-and-swap when a caller computed outside the lock."""
    values = (json.dumps(room, ensure_ascii=False), int(time.time()) + ROOM_TTL,
              room["version"], room["phase"], room.get("turnDeadline"), room.get("waitingExpiresAt"))
    if expected_version is None:
        db.execute("""INSERT INTO poker_rooms(room_id,code,payload,expires_at,version,phase,turn_deadline,waiting_expires_at)
            VALUES (?,?,?,?,?,?,?,?) ON CONFLICT(room_id) DO UPDATE SET
            payload=excluded.payload,expires_at=excluded.expires_at,version=excluded.version,phase=excluded.phase,
            turn_deadline=excluded.turn_deadline,waiting_expires_at=excluded.waiting_expires_at""",
                   (room["roomId"], room["code"], *values))
    else:
        db.lock("poker:" + room["roomId"])
        changed = db.execute("""UPDATE poker_rooms SET payload=?,expires_at=?,version=?,phase=?,turn_deadline=?,waiting_expires_at=?
            WHERE room_id=? AND version=? AND expires_at>=?""",
                             (*values, room["roomId"], expected_version, int(time.time()))).rowcount
        if changed != 1:
            raise HTTPException(409, "Состояние стола изменилось. Обнови стол и повтори ход")
    _save_members(db, room)


def _save_members(db, room: dict) -> None:
    for player in room["players"]:
        if player["identity"].startswith("tg:"):
            db.execute("INSERT OR IGNORE INTO poker_room_members(room_id,user_id) VALUES (?,?)",
                       (room["roomId"], int(player["identity"][3:])))


def _notify(room: dict) -> None:
    from .realtime import publish
    publish("poker:" + room["roomId"], {"version": room["version"]})
    for player in room["players"]:
        if player["identity"].startswith("tg:"):
            publish("user:" + player["identity"][3:], {"type": "lobby.changed"})


def create_match_room(first_user: dict, second_user: dict, db) -> dict:
    """Allocate a matched table inside the lobby's existing transaction.

    The caller owns commit and notification, so queue rows and room allocation
    either all persist or all roll back together.
    """
    if not db.in_write or int(first_user["id"]) == int(second_user["id"]):
        raise ValueError("A match needs a write transaction and two distinct users")
    _capacity(db)
    room = _new_room("online", _player(f"tg:{first_user['id']}", first_user.get("first_name")))
    room["players"].append(_player(f"tg:{second_user['id']}", second_user.get("first_name")))
    _start_hand(room)
    _save(db, room)
    return room


def list_user_rooms(user_id: int) -> list[dict]:
    with _connection() as db:
        rows = db.execute("""SELECT r.payload FROM poker_rooms r JOIN poker_room_members m ON m.room_id=r.room_id
            WHERE m.user_id=? AND r.expires_at>=? AND r.phase<>'closed' ORDER BY r.expires_at DESC LIMIT 30""",
                          (user_id, int(time.time()))).fetchall()
    return [player_view(room, _seat(room, {"userId": user_id})) for row in rows for room in [json.loads(row["payload"])]]


def _expire(room_id: str, now: float) -> bool:
    with _connection() as db:
        try:
            room = _load(db, room_id)
        except HTTPException:
            return False
    deadline = room.get("waitingExpiresAt") if room["phase"] == "waiting" else room.get("turnDeadline")
    if room["mode"] != "online" or deadline is None or deadline > now:
        return False
    previous = room["version"]
    if room["phase"] == "waiting":
        room.update(phase="closed", turnIndex=None)
        _log(room, "Время ожидания соперника истекло")
    elif room["phase"] == "playing":
        apply_action(room, room["turnIndex"], "fold")
        _log(room, "Время хода истекло · автоматический пас")
    else:
        return False
    _refresh_deadlines(room)
    room["version"] += 1
    try:
        with _connection(True) as db:
            _save(db, room, previous)
    except HTTPException as error:
        if error.status_code == 409:
            return False
        raise
    _notify(room)
    return True


def tick_timeouts(now: float | None = None) -> int:
    """Idempotent across workers: only a successful CAS emits an event."""
    now = time.time() if now is None else now
    with _connection() as db:
        rows = db.execute("""SELECT room_id FROM poker_rooms WHERE expires_at>=? AND
            ((phase='playing' AND turn_deadline<=?) OR (phase='waiting' AND waiting_expires_at<=?))""",
                          (int(time.time()), int(now), int(now))).fetchall()
    return sum(_expire(row["room_id"], now) for row in rows)


def _load(db, room_id: str) -> dict:
    row = db.execute("SELECT payload FROM poker_rooms WHERE room_id=? AND expires_at>=?", (room_id, int(time.time()))).fetchone()
    if not row:
        raise HTTPException(404, "Стол не найден или срок хранения истёк")
    return json.loads(row["payload"])


def _seat(room: dict, identity: dict) -> int:
    token = identity.get("tokenHash")
    if token and room["mode"] == "solo" and room["tokenHash"] and secrets.compare_digest(token, room["tokenHash"]):
        return 0
    user_id = identity.get("userId")
    for seat, player in enumerate(room["players"]):
        if user_id is not None and player["identity"] == f"tg:{user_id}":
            return seat
    raise HTTPException(403, "Этот стол принадлежит другим игрокам")


async def get_poker_identity(x_poker_token: str | None = Header(default=None, alias="X-Poker-Token"),
                             x_init_data: str | None = Header(default=None, alias="X-Init-Data")) -> dict:
    if x_poker_token:
        if not 32 <= len(x_poker_token) <= 128:
            raise HTTPException(401, "Неверный токен одиночного стола")
        return {"tokenHash": hashlib.sha256(x_poker_token.encode()).hexdigest()}
    user = await get_current_user(x_init_data)
    return {"userId": int(user["id"])}


class SoloRequest(BaseModel):
    name: str = Field(default="Игрок", max_length=128)


class JoinRequest(BaseModel):
    code: str = Field(min_length=6, max_length=6)


class ActionRequest(BaseModel):
    action: Literal["fold", "check", "call", "raise", "next", "leave"]
    amount: int | None = Field(default=None, ge=1, le=2000, strict=True)
    version: int = Field(ge=1, strict=True)


def _capacity(db) -> None:
    db.lock("poker:capacity")
    db.execute("DELETE FROM poker_rooms WHERE expires_at < ?", (int(time.time()),))
    if db.execute("SELECT COUNT(*) FROM poker_rooms WHERE phase<>'closed'").fetchone()[0] >= MAX_ROOMS:
        raise HTTPException(503, "Столы временно заняты. Попробуй позже")


@router.post("/solo")
def solo(payload: SoloRequest, x_init_data: str | None = Header(default=None, alias="X-Init-Data")) -> dict:
    user = verify_init_data(x_init_data) if x_init_data else None
    if x_init_data and user is None:
        raise HTTPException(401, "Invalid or expired Telegram initData")
    token = secrets.token_urlsafe(32)
    owner = _player(f"tg:{user['id']}" if user else "guest", user.get("first_name") if user else payload.name)
    room = _new_room("solo", owner)
    room["tokenHash"] = hashlib.sha256(token.encode()).hexdigest()
    room["players"].append(_player("bot", "Тера · бот", True))
    _start_hand(room)
    with _connection(True) as db:
        _capacity(db)
        _save(db, room)
    _notify(room)
    return {"roomId": room["roomId"], "token": token, "state": player_view(room, 0)}


@router.post("/rooms")
def create_room(user: dict = Depends(get_current_user)) -> dict:
    room = _new_room("online", _player(f"tg:{user['id']}", user.get("first_name")))
    with _connection(True) as db:
        _capacity(db)
        _save(db, room)
    _notify(room)
    return {"roomId": room["roomId"], "state": player_view(room, 0)}


@router.post("/rooms/join")
def join_room(payload: JoinRequest, user: dict = Depends(get_current_user)) -> dict:
    changed = False
    with _connection(True) as db:
        # A code and a room ID must resolve to the same lock for concurrent
        # joins/actions; discover the ID, then re-read after the room lock.
        row = db.execute("SELECT payload FROM poker_rooms WHERE code=? AND expires_at>=?", (payload.code.upper(), int(time.time()))).fetchone()
        if not row:
            raise HTTPException(404, "Комната с таким кодом не найдена")
        room = json.loads(row["payload"])
        db.lock("poker:" + room["roomId"])
        room = _load(db, room["roomId"])
        identity = f"tg:{user['id']}"
        if room["mode"] != "online" or room["phase"] == "closed" or (
                room["phase"] == "waiting" and room.get("waitingExpiresAt") is not None and room["waitingExpiresAt"] <= time.time()):
            raise HTTPException(409, "Этот стол недоступен для подключения")
        seat = next((i for i, p in enumerate(room["players"]) if p["identity"] == identity), None)
        if seat is None:
            if len(room["players"]) >= 2 or room["phase"] != "waiting":
                raise HTTPException(409, "В комнате уже два игрока")
            room["players"].append(_player(identity, user.get("first_name")))
            seat = 1
            _start_hand(room)
            room["version"] += 1
            _save(db, room)
            changed = True
    if changed:
        _notify(room)
    return {"roomId": room["roomId"], "state": player_view(room, seat)}


@router.get("/rooms/{room_id}")
def get_room(room_id: str, identity: dict = Depends(get_poker_identity)) -> dict:
    with _connection() as db:
        room = _load(db, room_id)
    return player_view(room, _seat(room, identity))


@router.post("/rooms/{room_id}/action")
def act(room_id: str, payload: ActionRequest, identity: dict = Depends(get_poker_identity)) -> dict:
    # Monte Carlo bot decisions happen on a private snapshot without holding a
    # SQLite global writer lock or a PostgreSQL room lock. A short CAS commit
    # ensures two requests can never spend the same chips.
    with _connection() as db:
        room = _load(db, room_id)
    seat = _seat(room, identity)
    if payload.version != room["version"]:
        raise HTTPException(409, "Состояние стола изменилось. Обнови стол и повтори ход")
    deadline = room.get("turnDeadline") if room["phase"] == "playing" else room.get("waitingExpiresAt") if room["phase"] == "waiting" else None
    if room["mode"] == "online" and deadline is not None and deadline <= time.time():
        _expire(room_id, time.time())
        raise HTTPException(409, "Время ожидания истекло. Обнови стол")
    try:
        apply_action(room, seat, payload.action, payload.amount)
        _bot_turn(room)
    except PokerRuleError as error:
        raise HTTPException(409, str(error)) from error
    _refresh_deadlines(room)
    room["version"] += 1
    with _connection(True) as db:
        db.lock("poker:" + room_id)
        if room["mode"] == "online" and deadline is not None and deadline <= time.time():
            # Waiting for the writer/room lock does not extend a player's turn.
            # The background timeout worker will persist the automatic fold.
            raise HTTPException(409, "Время ожидания истекло. Обнови стол")
        _save(db, room, payload.version)
    _notify(room)
    return player_view(room, seat)


@router.get("/rooms/{room_id}/hint")
def hint(room_id: str, identity: dict = Depends(get_poker_identity)) -> dict:
    with _connection() as db:
        room = _load(db, room_id)
    seat = _seat(room, identity)
    if room["phase"] != "playing":
        raise HTTPException(409, "Подсказка доступна во время раздачи")
    player = room["players"][seat]
    samples = 400
    equity = estimate_equity(player["hole"], room["board"], samples)
    pot, call, odds = _pot_numbers(room, seat)
    ev = equity * pot - (1 - equity) * call
    text = (f"Эквити ≈ {equity:.0%}: средняя доля банка против случайной руки, включая делёж. "
            f"Оценка по {samples} симуляциям только своих и общих карт. ")
    if call:
        text += (f"Колл {call} за доступный банк {pot}: порог {call}/({pot}+{call}) = {odds:.1%}. "
                 f"EV колла ≈ {equity:.2f} × {pot} − {1-equity:.2f} × {call} = {ev:+.1f} фишки. "
                 "Формула не учитывает будущие ставки, рейз, пас соперника и его диапазон. ")
    else:
        text += "Колл не требуется: чек бесплатен. Эквити сама по себе не определяет размер ставки. "
    if call:
        text += ("При этих допущениях колл выгоднее паса на дистанции. " if ev > 0 else
                 "При этих допущениях пас выгоднее колла на дистанции. " if ev < 0 else
                 "При этих допущениях колл и пас дают одинаковое ожидание. ")
    text += "Математика помогает оценивать решения на дистанции, но не гарантирует победу в раздаче."
    return {"equity": equity, "potOdds": odds, "callEV": round(ev, 2), "samples": samples,
            "toCall": call, "pot": pot, "version": room["version"], "text": text,
            "handName": HAND_NAMES[evaluate(player["hole"] + room["board"])[0]] if len(room["board"]) >= 3 else None}
