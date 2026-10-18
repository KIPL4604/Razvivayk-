"""Opt-in proof that independent API processes share private poker events.

Uses only dedicated PLATFORM_TEST_DATABASE_URL / PLATFORM_TEST_REDIS_URL
services. It starts its own loopback Uvicorn processes with a test bot token,
then checks Redis fan-out and durable state after restarting one worker.
"""
import hashlib
import hmac
import json
import os
from pathlib import Path
import socket
import subprocess
import sys
import tempfile
import time
import unittest
from urllib.parse import urlencode
import uuid

import httpx
from websockets.sync.client import connect
from websockets.exceptions import ConnectionClosed

ROOT = Path(__file__).resolve().parents[1]
TOKEN = "teramont-cross-process-test"


def signed(user_id):
    values = {"auth_date": str(int(time.time())), "user": json.dumps({"id": user_id, "first_name": "Process test"})}
    secret = hmac.new(b"WebAppData", TOKEN.encode(), hashlib.sha256).digest()
    values["hash"] = hmac.new(secret, "\n".join(f"{k}={v}" for k, v in sorted(values.items())).encode(), hashlib.sha256).hexdigest()
    return urlencode(values)


def available_port():
    with socket.socket() as candidate:
        candidate.bind(("127.0.0.1", 0))
        return candidate.getsockname()[1]


def receive(ws, kind):
    deadline = time.monotonic() + 8
    while time.monotonic() < deadline:
        message = json.loads(ws.recv(timeout=max(0.1, deadline - time.monotonic())))
        if message.get("type") == kind:
            return message
    raise AssertionError(f"Expected {kind} event")


@unittest.skipUnless(os.getenv("PLATFORM_TEST_DATABASE_URL") and os.getenv("PLATFORM_TEST_REDIS_URL"),
                     "Dedicated PostgreSQL and Redis test URLs not configured")
class RealtimeProcessTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.folder = tempfile.TemporaryDirectory()
        cls.processes = {}
        cls.ports = [available_port(), available_port()]
        while cls.ports[0] == cls.ports[1]:
            cls.ports[1] = available_port()
        cls.environment = {**os.environ, "TG_BOT_TOKEN": TOKEN,
                           "DATABASE_URL": os.environ["PLATFORM_TEST_DATABASE_URL"],
                           "REDIS_URL": os.environ["PLATFORM_TEST_REDIS_URL"],
                           "DATABASE_POOL_SIZE": "12",
                           "APP_URL": "http://127.0.0.1", "PYTHONUNBUFFERED": "1",
                           "GAME_DB_PATH": str(Path(cls.folder.name) / "unused.sqlite3"),
                           "POKER_DB_PATH": ""}
        cls.http = httpx.Client(timeout=8, trust_env=False)
        try:
            cls.start_worker(0)
            cls.start_worker(1)
        except Exception:
            cls.tearDownClass()
            raise

    @classmethod
    def start_worker(cls, index):
        log = open(Path(cls.folder.name) / f"worker-{index}.log", "ab")
        process = subprocess.Popen([
            sys.executable, "-m", "uvicorn", "webapp.backend.main:app",
            "--host", "127.0.0.1", "--port", str(cls.ports[index]),
            "--workers", "1", "--no-access-log", "--log-level", "warning",
        ], cwd=ROOT, env=cls.environment, stdin=subprocess.DEVNULL,
            stdout=log, stderr=subprocess.STDOUT,
            creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0))
        cls.processes[index] = (process, log)
        deadline = time.monotonic() + 30
        while time.monotonic() < deadline:
            if process.poll() is not None:
                break
            try:
                response = cls.http.get(cls.url(index) + "/healthz")
                if response.status_code == 200:
                    return
            except httpx.HTTPError:
                pass
            time.sleep(0.1)
        log.flush()
        output = (Path(cls.folder.name) / f"worker-{index}.log").read_text(encoding="utf-8", errors="replace")
        raise RuntimeError(f"Test worker {index} did not start: {output[-4000:]}")

    @classmethod
    def stop_worker(cls, index):
        process, log = cls.processes.pop(index)
        if process.poll() is None:
            if os.name == "nt":
                # Windows venv python.exe can be a launcher with a child Python
                # process. Kill only this test-owned PID and its descendants,
                # so neither a listener nor its inherited log handle survives.
                subprocess.run(["taskkill", "/PID", str(process.pid), "/T", "/F"],
                               stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
                               timeout=10, check=False,
                               creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0))
            else:
                process.terminate()
            try:
                process.wait(timeout=10)
            except subprocess.TimeoutExpired:
                process.kill()
                process.wait(timeout=5)
        log.close()

    @classmethod
    def tearDownClass(cls):
        for index in tuple(cls.processes):
            cls.stop_worker(index)
        cls.http.close()
        for attempt in range(10):
            try:
                cls.folder.cleanup()
                break
            except PermissionError:
                if attempt == 9:
                    raise
                time.sleep(.1)

    @classmethod
    def url(cls, index):
        return f"http://127.0.0.1:{cls.ports[index]}"

    def websocket(self, index, data, room_id):
        manager = connect(self.url(index).replace("http://", "ws://") + "/api/platform/ws",
                          open_timeout=5, close_timeout=2)
        ws = manager.__enter__()
        self.addCleanup(manager.__exit__, None, None, None)
        ws.send(json.dumps({"type": "auth", "initData": data, "roomId": room_id}))
        self.assertEqual(receive(ws, "ready"), {"type": "ready"})
        return ws

    def test_private_updates_cross_processes_and_restart_recovers_current_state(self):
        user_base = 2_000_000_000 + int(uuid.uuid4().hex[:9], 16) * 10
        first, second, stranger = (signed(user_base + index) for index in range(3))
        headers = [{"X-Init-Data": first}, {"X-Init-Data": second}]
        response = self.http.post(self.url(0) + "/api/poker/rooms", headers=headers[0])
        self.assertEqual(response.status_code, 200)
        created = response.json()
        room_id = created["roomId"]
        ws_first = self.websocket(0, first, room_id)
        ws_second = None
        latest = None
        try:
            self.assertEqual(receive(ws_first, "poker.state")["state"]["phase"], "waiting")
            joined = self.http.post(self.url(1) + "/api/poker/rooms/join", headers=headers[1],
                                    json={"code": created["state"]["code"]})
            self.assertEqual(joined.status_code, 200)
            own = receive(ws_first, "poker.state")["state"]
            self.assertEqual(own["version"], joined.json()["state"]["version"])
            self.assertEqual(own["players"][1]["hole"], [None, None])
            self.assertEqual(len(own["players"][0]["hole"]), 2)
            self.assertNotIn("deck", own)
            ws_second = self.websocket(1, second, room_id)
            peer = receive(ws_second, "poker.state")["state"]
            self.assertEqual(peer["players"][0]["hole"], [None, None])
            # A move reaches process 1 while the acting user's socket is on 0.
            moved = self.http.post(self.url(1) + f"/api/poker/rooms/{room_id}/action", headers=headers[0],
                                   json={"action": "call", "version": own["version"]})
            self.assertEqual(moved.status_code, 200)
            self.assertEqual(receive(ws_first, "poker.state")["state"]["version"], moved.json()["version"])
            self.assertEqual(receive(ws_second, "poker.state")["state"]["version"], moved.json()["version"])
            ws_first.close()
            self.stop_worker(0)
            moved = self.http.post(self.url(1) + f"/api/poker/rooms/{room_id}/action", headers=headers[1],
                                   json={"action": "check", "version": moved.json()["version"]})
            self.assertEqual(moved.status_code, 200)
            latest = moved.json()
            self.assertEqual(len(latest["board"]), 3)
            self.start_worker(0)
            ws_first = self.websocket(0, first, room_id)
            restored = receive(ws_first, "poker.state")["state"]
            self.assertEqual(restored["version"], latest["version"])
            self.assertEqual(restored["board"], latest["board"])
            self.assertEqual(restored["players"][0]["hole"], own["players"][0]["hole"])
            self.assertEqual(restored["players"][1]["hole"], [None, None])
            with connect(self.url(0).replace("http://", "ws://") + "/api/platform/ws", close_timeout=2) as ws:
                ws.send(json.dumps({"type": "auth", "initData": stranger, "roomId": room_id}))
                with self.assertRaises(ConnectionClosed) as denied:
                    ws.recv(timeout=3)
                self.assertEqual(denied.exception.rcvd.code, 1008)
        finally:
            ws_first.close()
            if ws_second:
                ws_second.close()
            if latest:
                current = self.http.get(self.url(1) + f"/api/poker/rooms/{room_id}", headers=headers[0])
                if current.status_code == 200:
                    self.http.post(self.url(1) + f"/api/poker/rooms/{room_id}/action", headers=headers[0],
                                   json={"action": "leave", "version": current.json()["version"]})


if __name__ == "__main__":
    unittest.main()
