"""Platform persistence, matching and private event delivery through real routes.

Set PLATFORM_TEST_DATABASE_URL / PLATFORM_TEST_REDIS_URL to dedicated test
services to run this same contract on PostgreSQL and Redis as well as SQLite.
"""
import asyncio
from concurrent.futures import ThreadPoolExecutor
from contextlib import asynccontextmanager
import hashlib
import hmac
import json
import os
from pathlib import Path
import tempfile
import time
import unittest
from unittest.mock import patch
from urllib.parse import urlencode
import uuid

from fastapi import FastAPI
from fastapi.testclient import TestClient
from starlette.websockets import WebSocketDisconnect

from webapp.backend import platform as p, poker, realtime
from webapp.backend.database import connection

TOKEN = "teramont-platform-contract-test"


def chess_save():
    return {"run": {"id": "test-portable-save", "moves": ["e2e4"], "side": "w", "level": "casual", "ended": False}}


def init_data(user):
    values = {"auth_date": str(int(time.time())), "user": json.dumps(user, ensure_ascii=False, separators=(",", ":"))}
    secret = hmac.new(b"WebAppData", TOKEN.encode(), hashlib.sha256).digest()
    values["hash"] = hmac.new(secret, "\n".join(f"{k}={v}" for k, v in sorted(values.items())).encode(), hashlib.sha256).hexdigest()
    return urlencode(values)


@asynccontextmanager
async def lifespan(app):
    poker.init_poker_db()
    p.init_platform_db()
    await realtime.start()
    try:
        yield
    finally:
        await realtime.stop()


def app():
    application = FastAPI(lifespan=lifespan)
    application.include_router(p.router)
    application.include_router(poker.router)
    application.include_router(realtime.router)
    return application


def event(ws, kind):
    for _ in range(12):
        message = ws.receive_json()
        if message.get("type") == kind:
            return message
    raise AssertionError(f"Expected {kind} event")


class PlatformTests(unittest.TestCase):
    def setUp(self):
        self.folder = tempfile.TemporaryDirectory()
        self.environment = patch.dict(os.environ, {
            "TG_BOT_TOKEN": TOKEN, "APP_URL": "https://games.test",
            "GAME_DB_PATH": str(Path(self.folder.name) / "platform.sqlite3"),
            "POKER_DB_PATH": str(Path(self.folder.name) / "platform.sqlite3"),
            "DATABASE_URL": os.getenv("PLATFORM_TEST_DATABASE_URL", ""),
            "REDIS_URL": os.getenv("PLATFORM_TEST_REDIS_URL", ""),
        })
        self.environment.start()
        base = 1_000_000_000 + int(uuid.uuid4().hex[:9], 16) * 10
        self.users = [{"id": base + i, "first_name": f"Игрок {i}"} for i in range(8)]
        self.headers = [{"X-Init-Data": init_data(user)} for user in self.users]
        self.client = TestClient(app())
        self.client.__enter__()

    def tearDown(self):
        self.client.__exit__(None, None, None)
        with connection(write=True) as db:
            for user in self.users:
                db.execute("DELETE FROM platform_saves WHERE user_id=?", (user["id"],))
                db.execute("DELETE FROM platform_matchmaking WHERE user_id=?", (user["id"],))
            # PostgreSQL contract runs share a dedicated DB; clean only rows
            # created by these identities, never unrelated sessions or users.
            rows = db.execute("SELECT room_id,payload FROM poker_rooms").fetchall()
            identities = {f"tg:{user['id']}" for user in self.users}
            for row in rows:
                if any(player["identity"] in identities for player in json.loads(row["payload"])["players"]):
                    db.execute("DELETE FROM poker_rooms WHERE room_id=?", (row["room_id"],))
        self.environment.stop()
        self.folder.cleanup()

    def match(self, index=0):
        return self.client.post("/api/platform/matchmaking", headers=self.headers[index], json={"game": "poker"})

    def online_room(self):
        made = self.client.post("/api/poker/rooms", headers=self.headers[0]).json()
        joined = self.client.post("/api/poker/rooms/join", headers=self.headers[1], json={"code": made["state"]["code"]})
        self.assertEqual(joined.status_code, 200)
        return joined.json()["state"]

    def test_catalog_capabilities_only_advertise_real_multiplayer(self):
        games = self.client.get("/api/platform/catalog").json()["games"]
        self.assertEqual(len(games), 13)
        lumen = next(g for g in games if g["id"] == "lumen")
        self.assertFalse(lumen["cloudSave"])
        self.assertEqual(lumen["resultAuthority"], "local")
        self.assertEqual([g["id"] for g in games if "multiplayer" in g["modes"]], ["poker"])
        self.assertEqual(sum(g["campaignLevels"] for g in games), 1000)
        self.assertEqual(self.client.get("/api/platform/saves").status_code, 401)
        self.assertEqual(self.client.get("/api/platform/lobby").status_code, 401)

    def test_saves_revision_conflict_size_and_account_isolation(self):
        saved = self.client.put("/api/platform/saves/chess", headers=self.headers[0],
                                json={"revision": 0, "state": chess_save()})
        self.assertEqual(saved.status_code, 200)
        self.assertEqual(saved.json()["revision"], 1)
        self.assertEqual(self.client.get("/api/platform/saves", headers=self.headers[1]).json(), {"saves": {}})
        conflict = self.client.put("/api/platform/saves/chess", headers=self.headers[0], json={"revision": 0, "state": chess_save()})
        self.assertEqual(conflict.status_code, 409)
        self.assertEqual(conflict.json()["detail"]["save"]["state"]["run"]["moves"], ["e2e4"])
        self.assertEqual(self.client.put("/api/platform/saves/chess", headers=self.headers[0],
                                         json={"revision": 1, "state": {"run": None}}).json()["revision"], 2)
        self.assertEqual(self.client.put("/api/platform/saves/poker", headers=self.headers[0],
                                         json={"revision": 0, "state": {"token": "must-not-upload"}}).status_code, 400)
        self.assertEqual(self.client.put("/api/platform/saves/chess", headers=self.headers[0],
                                         json={"revision": 2, "state": {"run": None, "blob": "я" * 70000}}).status_code, 413)
        self.assertEqual(self.client.put("/api/platform/saves/chess", headers=self.headers[0],
                                         json={"revision": True, "state": {}}).status_code, 422)

    def test_concurrent_save_writers_get_one_commit_and_one_conflict(self):
        def write(value):
            return self.client.put("/api/platform/saves/memory", headers=self.headers[0],
                                   json={"revision": 0, "state": {"run": {"type": "memory", "fixture": value}}}).status_code
        with ThreadPoolExecutor(max_workers=2) as pool:
            self.assertEqual(sorted(pool.map(write, ("first", "second"))), [200, 409])
        record = self.client.get("/api/platform/saves", headers=self.headers[0]).json()["saves"]["memory"]
        self.assertEqual(record["revision"], 1)

    def test_cancel_expiry_and_no_self_matching(self):
        waiting = self.match().json()["matchmaking"]
        self.assertEqual(waiting["status"], "waiting")
        self.assertEqual(self.match().json()["matchmaking"], waiting)
        cancelled = self.client.delete("/api/platform/matchmaking", headers=self.headers[0]).json()["matchmaking"]
        self.assertEqual(cancelled, {"status": "idle"})
        self.match()
        with connection(write=True) as db:
            db.execute("UPDATE platform_matchmaking SET expires_at=? WHERE user_id=?", (int(time.time()) - 1, self.users[0]["id"]))
        self.assertEqual(self.match(1).json()["matchmaking"]["status"], "waiting")
        self.assertEqual(self.client.get("/api/platform/lobby", headers=self.headers[0]).json()["matchmaking"], {"status": "idle"})

    def test_saves_reject_mismatched_game_malformed_run_and_excessive_nesting(self):
        for state in ({"run": []}, {"run": {"type": "tiles"}}, {"other": {}},
                      {"run": {"type": "memory", "__proto__": {}}}):
            response = self.client.put("/api/platform/saves/memory", headers=self.headers[0], json={"revision": 0, "state": state})
            self.assertEqual(response.status_code, 422)
        state = {"run": {"type": "memory"}}
        child = state
        for _ in range(25):
            child["nested"] = {}
            child = child["nested"]
        self.assertEqual(self.client.put("/api/platform/saves/memory", headers=self.headers[0],
                                         json={"revision": 0, "state": state}).status_code, 422)
        state = chess_save()
        state["stats"] = {"wins": "<img src=x>"}
        self.assertEqual(self.client.put("/api/platform/saves/chess", headers=self.headers[0],
                                         json={"revision": 0, "state": state}).status_code, 422)

    def test_match_two_users_persists_same_room_and_safe_views(self):
        self.assertEqual(self.match().json()["matchmaking"]["status"], "waiting")
        result = self.match(1).json()["matchmaking"]
        self.assertEqual(result["status"], "matched")
        for index in (0, 1):
            lobby = self.client.get("/api/platform/lobby", headers=self.headers[index]).json()
            self.assertEqual(lobby["matchmaking"], result)
            room = next(room for room in lobby["rooms"] if room["roomId"] == result["roomId"])
            self.assertEqual(room["phase"], "playing")
            self.assertEqual(room["players"][1 - room["youIndex"]]["hole"], [None, None])
            self.assertNotIn("deck", room)
            self.assertNotIn("tokenHash", json.dumps(room))
        self.assertEqual(self.match().json()["matchmaking"], result)
        self.assertEqual(self.client.delete("/api/platform/matchmaking", headers=self.headers[0]).json()["matchmaking"], result)
        self.assertEqual(self.client.get("/api/platform/lobby", headers=self.headers[2]).json()["rooms"], [])

    def test_concurrent_matchmaking_does_not_double_pair(self):
        with ThreadPoolExecutor(max_workers=4) as pool:
            replies = list(pool.map(self.match, range(4)))
        self.assertTrue(all(reply.status_code == 200 for reply in replies))
        rooms = [self.client.get("/api/platform/lobby", headers=self.headers[index]).json()["matchmaking"]["roomId"]
                 for index in range(4)]
        self.assertEqual(len(set(rooms)), 2)
        self.assertTrue(all(rooms.count(room) == 2 for room in rooms))

    def test_match_failure_rolls_back_queue_and_room(self):
        self.match()
        actual = poker.create_match_room

        def failed(first, second, db):
            actual(first, second, db)
            raise RuntimeError("simulated failure before commit")
        with patch.object(poker, "create_match_room", side_effect=failed):
            with self.assertRaises(RuntimeError):
                self.match(1)
        lobby = self.client.get("/api/platform/lobby", headers=self.headers[0]).json()
        self.assertEqual(lobby["matchmaking"]["status"], "waiting")
        self.assertEqual(lobby["rooms"], [])
        self.assertEqual(self.match(1).json()["matchmaking"]["status"], "matched")

    def test_ws_rejects_bad_auth_origin_and_other_players_room(self):
        room = self.online_room()
        with self.assertRaises(WebSocketDisconnect):
            with self.client.websocket_connect("/api/platform/ws", headers={"Origin": "https://evil.test"}):
                pass
        for auth in ({"type": "ping"}, {"type": "auth", "initData": "invalid"},
                     {"type": "auth", "initData": self.headers[2]["X-Init-Data"], "roomId": room["roomId"]}):
            with self.client.websocket_connect("/api/platform/ws") as ws:
                ws.send_json(auth)
                with self.assertRaises(WebSocketDisconnect) as stopped:
                    ws.receive_json()
                self.assertEqual(stopped.exception.code, 1008)

    def test_ws_join_push_private_snapshot_and_reconnect_current_version(self):
        made = self.client.post("/api/poker/rooms", headers=self.headers[0]).json()
        with self.client.websocket_connect("/api/platform/ws") as ws:
            ws.send_json({"type": "auth", "initData": self.headers[0]["X-Init-Data"], "roomId": made["roomId"]})
            self.assertEqual(ws.receive_json(), {"type": "ready"})
            self.assertEqual(ws.receive_json()["state"]["phase"], "waiting")
            joined = self.client.post("/api/poker/rooms/join", headers=self.headers[1], json={"code": made["state"]["code"]}).json()["state"]
            message = event(ws, "poker.state")
            self.assertEqual(message["type"], "poker.state")
            private = message["state"]
            self.assertEqual(private["version"], joined["version"])
            self.assertEqual(private["players"][1]["hole"], [None, None])
            self.assertEqual(len(private["players"][0]["hole"]), 2)
            self.assertNotIn("deck", private)
            acted = self.client.post(f"/api/poker/rooms/{made['roomId']}/action", headers=self.headers[0],
                                     json={"version": private["version"], "action": "call"}).json()
            self.assertEqual(event(ws, "poker.state")["state"]["version"], acted["version"])
        with self.client.websocket_connect("/api/platform/ws") as ws:
            ws.send_json({"type": "auth", "initData": self.headers[0]["X-Init-Data"], "roomId": made["roomId"]})
            self.assertEqual(ws.receive_json(), {"type": "ready"})
            self.assertEqual(ws.receive_json()["state"]["version"], acted["version"])
            ws.send_json({"type": "ping"})
            self.assertEqual(ws.receive_json(), {"type": "pong"})

    def test_ws_lobby_match_and_cloud_invalidation_are_account_scoped(self):
        with self.client.websocket_connect("/api/platform/ws") as ws:
            ws.send_json({"type": "auth", "initData": self.headers[0]["X-Init-Data"]})
            self.assertEqual(ws.receive_json(), {"type": "ready"})
            self.match()
            self.assertEqual(ws.receive_json(), {"type": "lobby.changed"})
            self.match(1)
            self.assertEqual(ws.receive_json(), {"type": "lobby.changed"})
            self.client.put("/api/platform/saves/chess", headers=self.headers[0], json={"revision": 0, "state": {"run": None}})
            self.assertEqual(ws.receive_json(), {"type": "cloud.changed", "game": "chess", "revision": 1})
            self.client.put("/api/platform/saves/chess", headers=self.headers[1], json={"revision": 0, "state": {"run": None}})
            ws.send_json({"type": "ping"})
            self.assertEqual(ws.receive_json(), {"type": "pong"})

    def test_ws_solo_token_only_authorizes_its_room(self):
        solo = self.client.post("/api/poker/solo", json={"name": "Гость"}).json()
        with self.client.websocket_connect("/api/platform/ws") as ws:
            ws.send_json({"type": "auth", "token": solo["token"], "roomId": solo["roomId"]})
            self.assertEqual(ws.receive_json(), {"type": "ready"})
            self.assertEqual(ws.receive_json()["state"]["roomId"], solo["roomId"])
            other = self.online_room()
            ws.send_json({"type": "subscribe", "roomId": other["roomId"]})
            with self.assertRaises(WebSocketDisconnect):
                ws.receive_json()


class SQLiteSplitStorageTests(unittest.TestCase):
    def test_legacy_separate_poker_path_keeps_queue_and_room_atomic(self):
        with tempfile.TemporaryDirectory() as folder, patch.dict(os.environ, {
            "DATABASE_URL": "", "GAME_DB_PATH": str(Path(folder) / "profiles.sqlite3"),
            "POKER_DB_PATH": str(Path(folder) / "poker.sqlite3"),
        }):
            poker.init_poker_db()
            p.init_platform_db()
            first, second = {"id": 800101, "first_name": "First"}, {"id": 800202, "first_name": "Second"}
            self.assertEqual(p.find_match(p.MatchRequest(), first)["matchmaking"]["status"], "waiting")
            matched = p.find_match(p.MatchRequest(), second)["matchmaking"]
            self.assertEqual(matched["status"], "matched")
            self.assertEqual(p.get_lobby(first)["rooms"][0]["roomId"], matched["roomId"])
            p.put_save("chess", p.SaveRequest(revision=0, state=chess_save()), first)
            with poker._connection() as db:
                self.assertEqual(db.execute("SELECT COUNT(*) FROM poker_rooms").fetchone()[0], 1)
                self.assertEqual(db.execute("SELECT COUNT(*) FROM platform_matchmaking").fetchone()[0], 2)
                self.assertNotIn("platform_saves", [row[0] for row in db.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall()])
            with connection() as db:
                self.assertEqual(db.execute("SELECT COUNT(*) FROM platform_saves").fetchone()[0], 1)
                self.assertNotIn("poker_rooms", [row[0] for row in db.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall()])


class HubBackpressureTests(unittest.IsolatedAsyncioTestCase):
    async def test_slow_clients_receive_resync_without_unbounded_queue(self):
        event_hub = realtime.EventHub()
        subscriber = event_hub.subscribe({"poker:test"})
        for version in range(100):
            event_hub._deliver("poker:test", {"version": version})
        self.assertLessEqual(subscriber.queue.qsize(), 32)
        events = [subscriber.queue.get_nowait() for _ in range(subscriber.queue.qsize())]
        self.assertTrue(any(topic == "control" for topic, _ in events))


@unittest.skipUnless(os.getenv("PLATFORM_TEST_REDIS_URL"), "Dedicated Redis test URL not configured")
class RedisFanoutTests(unittest.IsolatedAsyncioTestCase):
    async def test_events_cross_independent_worker_hubs_and_reconnect_resync(self):
        with patch.dict(os.environ, {"REDIS_URL": os.environ["PLATFORM_TEST_REDIS_URL"]}):
            first, second = realtime.EventHub(), realtime.EventHub()
            # This isolated transport contract doesn't touch game tables.
            with patch.object(realtime.EventHub, "_maintain", new=self._idle):
                await first.start()
                await second.start()
            try:
                topic = f"poker:{uuid.uuid4().hex}"
                subscriber = second.subscribe({topic})
                await first._publish(topic, {"version": 17})
                received = await asyncio.wait_for(subscriber.queue.get(), 3)
                self.assertEqual(received, (topic, {"version": 17}))
                second.redis_connected = False
                received = await asyncio.wait_for(subscriber.queue.get(), 3)
                self.assertEqual(received, ("*", {"type": "resync"}))
            finally:
                await first.stop()
                await second.stop()

    @staticmethod
    async def _idle(_hub):
        await asyncio.Event().wait()


if __name__ == "__main__":
    unittest.main()
