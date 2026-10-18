"""Authenticated events with private snapshots, reconnect and Redis fan-out.

The broker carries room versions and account invalidations only. It never
broadcasts a persisted poker payload: every socket loads its own safe view after
an event, and reconnect starts with that current durable snapshot.
"""
from __future__ import annotations

import asyncio
from contextlib import suppress
from dataclasses import dataclass, field
import hashlib
import json
import logging
import os
import secrets
import time
from urllib.parse import urlsplit

from fastapi import APIRouter, HTTPException, WebSocket, WebSocketDisconnect
from starlette.concurrency import run_in_threadpool

from .auth import verify_init_data

router = APIRouter()
logger = logging.getLogger(__name__)
CHANNEL = "teramont:platform:events:v1"
AUTH_TIMEOUT = 5
HEARTBEAT_SECONDS = 25
IDLE_SECONDS = 80
MAX_MESSAGE_BYTES = 16 * 1024


@dataclass(eq=False)
class Subscription:
    topics: set[str] = field(default_factory=set)
    queue: asyncio.Queue = field(default_factory=lambda: asyncio.Queue(maxsize=32))


class EventHub:
    def __init__(self):
        self.loop = None
        self.subscribers: set[Subscription] = set()
        self.redis = None
        self.pubsub = None
        self.tasks: set[asyncio.Task] = set()
        self.listener = None
        self.maintenance = None
        self.instance = secrets.token_hex(16)
        self.redis_connected = False

    async def start(self):
        if self.loop is not None:
            raise RuntimeError("Realtime hub is already running")
        self.loop = asyncio.get_running_loop()
        redis_url = os.getenv("REDIS_URL", "")
        try:
            if redis_url:
                from redis.asyncio import Redis
                self.redis = Redis.from_url(redis_url, decode_responses=True,
                                            socket_connect_timeout=5, socket_timeout=5,
                                            health_check_interval=15)
                await self.redis.ping()
                self.pubsub = self.redis.pubsub(ignore_subscribe_messages=True)
                await self.pubsub.subscribe(CHANNEL)
                self.redis_connected = True
                self.listener = asyncio.create_task(self._listen())
            self.maintenance = asyncio.create_task(self._maintain())
        except Exception:
            await self.stop()
            raise

    async def stop(self):
        self.loop = None
        pending = list(self.tasks)
        pending += [task for task in (self.listener, self.maintenance) if task]
        for task in pending:
            task.cancel()
        if pending:
            await asyncio.gather(*pending, return_exceptions=True)
        self.tasks.clear()
        if self.pubsub:
            await self.pubsub.aclose()
        if self.redis:
            await self.redis.aclose()
        self.redis = self.pubsub = self.listener = self.maintenance = None
        self.redis_connected = False
        self.subscribers.clear()
        self.loop = None

    def subscribe(self, topics=()) -> Subscription:
        subscriber = Subscription(set(topics))
        self.subscribers.add(subscriber)
        return subscriber

    def unsubscribe(self, subscriber):
        self.subscribers.discard(subscriber)

    def _deliver(self, topic, payload):
        for subscriber in tuple(self.subscribers):
            if topic not in subscriber.topics and topic != "*":
                continue
            if subscriber.queue.full():
                # A lagging socket reconnects to a complete persisted snapshot;
                # unbounded queues would leak memory and replay stale versions.
                while not subscriber.queue.empty():
                    subscriber.queue.get_nowait()
                subscriber.queue.put_nowait(("control", {"type": "overflow"}))
            else:
                subscriber.queue.put_nowait((topic, payload))

    async def _publish(self, topic, payload):
        self._deliver(topic, payload)
        if self.redis:
            try:
                await self.redis.publish(CHANNEL, json.dumps(
                    {"origin": self.instance, "topic": topic, "payload": payload}, separators=(",", ":")))
            except Exception:
                # Redis listener reconnect invalidates every local socket, so a
                # transient pub/sub outage is repaired from durable room state.
                self.redis_connected = False
                logger.warning("Platform event broker unavailable; clients will resync on reconnect")

    def publish(self, topic, payload):
        loop = self.loop
        if loop is None or loop.is_closed():
            return

        def schedule():
            if self.loop is not loop:
                return
            task = asyncio.create_task(self._publish(topic, payload))
            self.tasks.add(task)
            task.add_done_callback(self.tasks.discard)
        with suppress(RuntimeError):
            loop.call_soon_threadsafe(schedule)

    async def _listen(self):
        retry = 0
        while True:
            try:
                message = await self.pubsub.get_message(timeout=1)
                if not self.redis_connected:
                    await self.redis.ping()
                    self.redis_connected = True
                    self._deliver("*", {"type": "resync"})
                retry = 0
                if message and message["type"] == "message":
                    envelope = json.loads(message["data"])
                    if envelope.get("origin") != self.instance:
                        self._deliver(envelope["topic"], envelope["payload"])
            except asyncio.CancelledError:
                raise
            except Exception:
                self.redis_connected = False
                retry = min(retry + 1, 5)
                await asyncio.sleep(retry)
                try:
                    await self.pubsub.aclose()
                    self.pubsub = self.redis.pubsub(ignore_subscribe_messages=True)
                    await self.pubsub.subscribe(CHANNEL)
                except Exception:
                    continue

    async def _maintain(self):
        while True:
            try:
                from . import poker
                from .platform import expire_queue
                await run_in_threadpool(poker.tick_timeouts)
                await run_in_threadpool(expire_queue)
            except asyncio.CancelledError:
                raise
            except Exception:
                logger.exception("Platform maintenance failed")
            await asyncio.sleep(1)


hub = EventHub()


async def start():
    await hub.start()


async def stop():
    await hub.stop()


def publish(topic: str, payload: dict):
    """Called by synchronous services only after their database commit succeeds."""
    # Keep broker payloads intentionally narrow, including for future callers.
    if topic.startswith("poker:"):
        version = payload.get("version")
        if not isinstance(version, int) or isinstance(version, bool):
            return
        payload = {"version": version}
    elif topic.startswith("user:"):
        event_type = payload.get("type", "lobby.changed")
        if event_type == "cloud.changed":
            payload = {"type": event_type, "game": payload.get("game"), "revision": payload.get("revision")}
        else:
            payload = {"type": "lobby.changed"}
    else:
        return
    hub.publish(topic, payload)


def status() -> dict:
    return {"transport": "redis" if hub.redis else "process", "connected": bool(hub.loop) and
            (hub.redis is None or hub.redis_connected)}


def _same_origin(websocket: WebSocket) -> bool:
    origin = websocket.headers.get("origin")
    if not origin:
        # Non-browser clients still have to present a valid Telegram signature
        # or an unguessable solo token in the first frame.
        return True
    incoming = urlsplit(origin)
    expected_host = websocket.headers.get("host", "")
    if incoming.netloc == expected_host and incoming.scheme in ("https", "http"):
        return True
    app = urlsplit(os.getenv("APP_URL", ""))
    return bool(app.netloc and incoming.scheme == app.scheme and incoming.netloc == app.netloc)


async def _read_message(websocket: WebSocket) -> dict:
    raw = await websocket.receive_text()
    if len(raw.encode("utf-8")) > MAX_MESSAGE_BYTES:
        raise ValueError("Frame too large")
    message = json.loads(raw)
    if not isinstance(message, dict):
        raise ValueError("Object required")
    return message


def _identity(message):
    init_data = message.get("initData")
    token = message.get("token")
    if init_data is not None and not isinstance(init_data, str):
        raise ValueError("Invalid Telegram data")
    user = verify_init_data(init_data) if init_data else None
    if init_data and not user:
        raise ValueError("Invalid Telegram data")
    if token is not None:
        if not isinstance(token, str) or not 32 <= len(token) <= 128:
            raise ValueError("Invalid solo token")
        identity = {"tokenHash": hashlib.sha256(token.encode()).hexdigest()}
    elif user:
        identity = {"userId": int(user["id"])}
    else:
        raise ValueError("Authentication required")
    if token is not None and not message.get("roomId"):
        raise ValueError("A solo token requires its room")
    return user, identity


async def _snapshot(room_id, identity):
    from . import poker
    return await run_in_threadpool(poker.get_room, room_id, identity)


@router.websocket("/api/platform/ws")
async def events(websocket: WebSocket):
    if not _same_origin(websocket):
        await websocket.close(code=1008)
        return
    await websocket.accept()
    subscriber = None
    receiver = sender = None
    room_id = None
    try:
        first = await asyncio.wait_for(_read_message(websocket), AUTH_TIMEOUT)
        if first.get("type") != "auth":
            raise ValueError("Authentication required")
        user, identity = _identity(first)
        requested_room = first.get("roomId")
        if requested_room is not None and (not isinstance(requested_room, str) or len(requested_room) > 64):
            raise ValueError("Invalid room")
        topics = {f"user:{user['id']}"} if user else set()
        if requested_room:
            room_id = requested_room
            topics.add(f"poker:{room_id}")
        subscriber = hub.subscribe(topics)
        # Subscribe before loading, so a concurrent committed move is either in
        # this snapshot or queued for the next one. No room identifier is echoed
        # if membership verification fails.
        state = await _snapshot(room_id, identity) if room_id else None
        await websocket.send_json({"type": "ready"})
        if state:
            await websocket.send_json({"type": "poker.state", "state": state})
        receiver = asyncio.create_task(_read_message(websocket))
        sender = asyncio.create_task(subscriber.queue.get())
        last_received = time.monotonic()
        while True:
            done, _ = await asyncio.wait((receiver, sender), timeout=HEARTBEAT_SECONDS,
                                         return_when=asyncio.FIRST_COMPLETED)
            if not done:
                if time.monotonic() - last_received > IDLE_SECONDS:
                    await websocket.close(code=1001)
                    return
                await websocket.send_json({"type": "ping"})
                continue
            if receiver in done:
                message = receiver.result()
                last_received = time.monotonic()
                kind = message.get("type")
                if kind == "ping":
                    await websocket.send_json({"type": "pong"})
                elif kind == "subscribe":
                    requested_room = message.get("roomId")
                    if requested_room is not None and (not isinstance(requested_room, str) or len(requested_room) > 64):
                        raise ValueError("Invalid room")
                    state = await _snapshot(requested_room, identity) if requested_room else None
                    # A subscribe operation never grants additional identity.
                    if room_id:
                        subscriber.topics.discard(f"poker:{room_id}")
                    room_id = requested_room
                    if room_id:
                        subscriber.topics.add(f"poker:{room_id}")
                        # Load again after subscribing to close the fetch/subscribe race.
                        state = await _snapshot(room_id, identity)
                        await websocket.send_json({"type": "poker.state", "state": state})
                elif kind != "pong":
                    raise ValueError("Unknown message")
                receiver = asyncio.create_task(_read_message(websocket))
            if sender in done:
                topic, payload = sender.result()
                if topic == "control":
                    await websocket.send_json({"type": "resync"})
                    await websocket.close(code=1013)
                    return
                if topic == "*" or topic == f"poker:{room_id}":
                    if topic == "*":
                        await websocket.send_json({"type": "resync"})
                    if room_id:
                        try:
                            state = await _snapshot(room_id, identity)
                            await websocket.send_json({"type": "poker.state", "state": state})
                        except HTTPException:
                            subscriber.topics.discard(f"poker:{room_id}")
                            room_id = None
                            await websocket.send_json({"type": "poker.unavailable"})
                    if topic == "*" and user:
                        await websocket.send_json({"type": "lobby.changed"})
                elif user and topic == f"user:{user['id']}":
                    await websocket.send_json(payload)
                sender = asyncio.create_task(subscriber.queue.get())
    except (ValueError, json.JSONDecodeError, asyncio.TimeoutError, HTTPException):
        with suppress(RuntimeError, WebSocketDisconnect):
            await websocket.close(code=1008)
    except WebSocketDisconnect:
        pass
    finally:
        pending = [task for task in (receiver, sender) if task]
        for task in pending:
            task.cancel()
        if pending:
            await asyncio.gather(*pending, return_exceptions=True)
        if subscriber:
            hub.unsubscribe(subscriber)
