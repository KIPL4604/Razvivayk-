"""Bounded loopback-only WebSocket/lobby smoke load, not a capacity benchmark.

Run against an isolated local API whose TG_BOT_TOKEN is also supplied via
PLATFORM_LOAD_BOT_TOKEN. No game is started and no profile/score is written.
"""
import argparse
import asyncio
import hashlib
import hmac
import json
import math
import os
import statistics
import time
from urllib.parse import urlencode, urlsplit
import uuid

import httpx
from websockets import connect


def signed(user_id, token):
    values = {"auth_date": str(int(time.time())), "user": json.dumps({"id": user_id, "first_name": "Load test"})}
    secret = hmac.new(b"WebAppData", token.encode(), hashlib.sha256).digest()
    values["hash"] = hmac.new(secret, "\n".join(f"{k}={v}" for k, v in sorted(values.items())).encode(), hashlib.sha256).hexdigest()
    return urlencode(values)


def timings(values):
    ordered = sorted(values)
    return {"count": len(values), "medianMs": round(statistics.median(ordered), 2),
            "p95Ms": round(ordered[max(0, math.ceil(len(ordered) * .95) - 1)], 2),
            "maxMs": round(ordered[-1], 2)} if values else {"count": 0}


async def run(args, token):
    base = args.url.rstrip("/")
    parsed = urlsplit(base)
    if parsed.scheme not in ("http", "https") or parsed.hostname not in ("127.0.0.1", "localhost", "::1"):
        raise ValueError("This smoke load only accepts a loopback http(s) URL")
    if parsed.username or parsed.password or parsed.query or parsed.fragment or parsed.path not in ("", "/"):
        raise ValueError("Use a plain loopback API origin without credentials or path")
    ws_url = base.replace("https://", "wss://", 1).replace("http://", "ws://", 1) + "/api/platform/ws"
    handshake_times, roundtrip_times, lobby_times = [], [], []
    errors = []
    connected = 0
    ready = asyncio.Event()
    started = time.monotonic()
    user_base = 3_000_000_000 + int(uuid.uuid4().hex[:9], 16) * 1000
    semaphore = asyncio.Semaphore(args.ramp)

    async with httpx.AsyncClient(timeout=15, trust_env=False,
                                 limits=httpx.Limits(max_connections=args.ramp)) as http:
        health = await http.get(base + "/healthz")
        health.raise_for_status()

        async def client(index):
            nonlocal connected
            auth = signed(user_base + index, token)
            ws = None
            try:
                async with semaphore:
                    before = time.monotonic()
                    ws = await connect(ws_url, open_timeout=15, close_timeout=2, ping_interval=20, max_queue=16)
                    await ws.send(json.dumps({"type": "auth", "initData": auth}))
                    message = json.loads(await asyncio.wait_for(ws.recv(), 15))
                    if message != {"type": "ready"}:
                        raise ValueError("WebSocket did not acknowledge authentication")
                    handshake_times.append((time.monotonic() - before) * 1000)
                    connected += 1
                    if connected == args.clients:
                        ready.set()
                await asyncio.wait_for(ready.wait(), 30)
                before = time.monotonic()
                response = await http.get(base + "/api/platform/lobby", headers={"X-Init-Data": auth})
                response.raise_for_status()
                lobby_times.append((time.monotonic() - before) * 1000)
                for _ in range(args.rounds):
                    before = time.monotonic()
                    await ws.send(json.dumps({"type": "ping"}))
                    while True:
                        message = json.loads(await asyncio.wait_for(ws.recv(), 15))
                        if message.get("type") == "pong":
                            break
                        if message.get("type") == "ping":
                            await ws.send(json.dumps({"type": "pong"}))
                    roundtrip_times.append((time.monotonic() - before) * 1000)
                    await asyncio.sleep(args.interval)
            except Exception as error:
                errors.append({"client": index, "error": type(error).__name__})
                # Release clients if an authentication/connection failed, so an
                # isolated failure doesn't turn into a thirty-second deadlock.
                ready.set()
            finally:
                if ws:
                    await ws.close()

        await asyncio.gather(*(client(index) for index in range(args.clients)))
    return {"scenario": "authenticated idle sockets, one lobby read each, application ping/pong",
            "clientsRequested": args.clients, "clientsConnected": connected, "rounds": args.rounds,
            "elapsedSeconds": round(time.monotonic() - started, 2), "handshake": timings(handshake_times),
            "lobbyRead": timings(lobby_times), "pingRoundtrip": timings(roundtrip_times),
            "errors": errors, "capacityClaim": False}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--url", default="http://127.0.0.1:8081")
    parser.add_argument("--clients", type=int, default=100, choices=range(1, 1001), metavar="1..1000")
    parser.add_argument("--ramp", type=int, default=20, choices=range(1, 101), metavar="1..100")
    parser.add_argument("--rounds", type=int, default=3, choices=range(1, 31), metavar="1..30")
    parser.add_argument("--interval", type=float, default=.25)
    args = parser.parse_args()
    if not 0 <= args.interval <= 10:
        parser.error("--interval must be between 0 and 10 seconds")
    token = os.getenv("PLATFORM_LOAD_BOT_TOKEN")
    if not token:
        parser.error("Set PLATFORM_LOAD_BOT_TOKEN to the isolated test API bot token")
    result = asyncio.run(run(args, token))
    print(json.dumps(result, ensure_ascii=False, indent=2))
    raise SystemExit(bool(result["errors"]))


if __name__ == "__main__":
    main()
