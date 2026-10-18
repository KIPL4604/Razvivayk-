"""Persistence boundaries: rollback, safe copying, poker CAS and deadlines."""
from concurrent.futures import ThreadPoolExecutor
from contextlib import closing
import json
import logging
import os
from pathlib import Path
import sqlite3
import tempfile
import threading
import time
import unittest
from unittest.mock import patch
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit
import uuid

from fastapi import HTTPException

from deploy.migrate_sqlite import migrate
from webapp.backend import poker
from webapp.backend.database import connection, close_pools, _postgres_sql, _pool_size, _PoolLogFilter


class DatabaseTests(unittest.TestCase):
    def setUp(self):
        self.folder = tempfile.TemporaryDirectory()
        self.path = Path(self.folder.name) / "test.sqlite3"

    def tearDown(self):
        self.folder.cleanup()

    def test_rows_parameters_columns_and_transaction_rollback(self):
        with connection(write=True, path=self.path) as db:
            self.assertEqual(db.dialect, "sqlite")
            self.assertTrue(db.in_write)
            db.lock("profile:900000000001")
            db.executescript("CREATE TABLE profiles (user_id INTEGER PRIMARY KEY, name TEXT); CREATE INDEX ix_name ON profiles(name);")
            db.executemany("INSERT INTO profiles VALUES (?,?)", ((900000000001, "Что? 50%"), (2, "O'Neil")))
            self.assertEqual(db.columns("profiles"), {"user_id", "name"})
        with self.assertRaisesRegex(ValueError, "rollback"), connection(write=True, path=self.path) as db:
            db.execute("UPDATE profiles SET name=? WHERE user_id=?", ("lost", 2))
            raise ValueError("rollback")
        with connection(path=self.path) as db:
            rows = list(db.execute("SELECT * FROM profiles ORDER BY user_id"))
            self.assertEqual(rows[0][1], "O'Neil")
            self.assertEqual(rows[1]["name"], "Что? 50%")
            self.assertEqual(dict(rows[1]), {"user_id": 900000000001, "name": "Что? 50%"})
            with self.assertRaises(RuntimeError):
                db.lock("requires-write")
            with self.assertRaises(ValueError):
                db.columns("profiles; DELETE")

    def test_executescript_preserves_ddl_rollback_and_literal_semicolons(self):
        with self.assertRaises(RuntimeError), connection(write=True, path=self.path) as db:
            db.executescript("CREATE TABLE messages (text TEXT); INSERT INTO messages VALUES ('a;b');")
            raise RuntimeError("rollback")
        with connection(path=self.path) as db:
            self.assertEqual(db.columns("messages"), set())

    def test_postgres_translation_is_narrow_and_preserves_quoted_question_marks(self):
        sql = _postgres_sql("INSERT OR IGNORE INTO test (name,value) VALUES ('50%? ''ok''',?)")
        self.assertEqual(sql, "INSERT INTO test (name,value) VALUES ('50%%? ''ok''',%s) ON CONFLICT DO NOTHING")
        self.assertIn("user_id BIGINT", _postgres_sql("CREATE TABLE test (user_id INTEGER, value TEXT)"))

    def test_pool_configuration_is_opt_in_bounded_and_redacts_driver_urls(self):
        for configured, expected in (("0", 0), ("-3", 0), ("1", 2), ("12", 12), ("500", 50)):
            with self.subTest(configured=configured), patch.dict(os.environ, {"DATABASE_POOL_SIZE": configured}):
                self.assertEqual(_pool_size(), expected)
        with patch.dict(os.environ, {"DATABASE_POOL_SIZE": "invalid"}), self.assertRaises(RuntimeError):
            _pool_size()
        record = logging.LogRecord("psycopg.pool", logging.WARNING, "test", 1,
                                   "connection failed: %s password='private value'",
                                   ("postgresql://user:secret@localhost/database",), None)
        _PoolLogFilter().filter(record)
        self.assertNotIn("secret", record.getMessage())
        self.assertNotIn("private value", record.getMessage())


class MigrationTests(unittest.TestCase):
    def setUp(self):
        self.folder = tempfile.TemporaryDirectory()
        self.source = Path(self.folder.name) / "source.sqlite3"
        self.target = Path(self.folder.name) / "target.sqlite3"
        self.backups = Path(self.folder.name) / "backups"
        with closing(sqlite3.connect(self.source)) as db:
            db.executescript("""
                CREATE TABLE game_profiles(user_id INTEGER PRIMARY KEY, first_name TEXT NOT NULL);
                CREATE TABLE game_sessions(session_id TEXT PRIMARY KEY, user_id INTEGER REFERENCES game_profiles(user_id));
                CREATE INDEX ix_session_user ON game_sessions(user_id);
                CREATE TABLE platform_saves(user_id INTEGER, game TEXT, state TEXT, PRIMARY KEY(user_id,game));
                CREATE TABLE unrelated_private_table(secret TEXT);
            """)
            db.execute("INSERT INTO game_profiles VALUES (?,?)", (900000000001, "Тест"))
            db.execute("INSERT INTO game_sessions VALUES (?,?)", ("session-1", 900000000001))
            db.execute("INSERT INTO platform_saves VALUES (?,?,?)", (900000000001, "chess", '{"moves":[]}'))
            db.commit()

    def tearDown(self):
        self.folder.cleanup()

    def test_dry_run_does_not_create_destination_or_backup(self):
        report = migrate(self.source, target_path=self.target, backup_dir=self.backups)
        self.assertEqual(report["mode"], "dry-run")
        self.assertEqual(report["tables"]["game_profiles"], 1)
        self.assertNotIn("unrelated_private_table", report["tables"])
        self.assertFalse(self.target.exists())
        self.assertFalse(self.backups.exists())

    def test_copy_backup_counts_and_rerun_refuses_overwriting(self):
        report = migrate(self.source, apply=True, target_path=self.target, backup_dir=self.backups)
        self.assertTrue(report["verified"])
        self.assertTrue(Path(report["backups"][0]).is_file())
        with connection(path=self.target) as db:
            self.assertEqual(db.execute("SELECT first_name FROM game_profiles WHERE user_id=?", (900000000001,)).fetchone()[0], "Тест")
            self.assertEqual(db.execute("SELECT COUNT(*) FROM game_sessions").fetchone()[0], 1)
        with self.assertRaisesRegex(ValueError, "not empty"):
            migrate(self.source, apply=True, target_path=self.target, backup_dir=self.backups)
        with connection(path=self.target) as db:
            self.assertEqual(db.execute("SELECT COUNT(*) FROM game_sessions").fetchone()[0], 1)

    def test_failed_foreign_key_rolls_back_whole_copy(self):
        with closing(sqlite3.connect(self.source)) as db:
            db.execute("INSERT INTO game_sessions VALUES ('invalid',123)")
            db.commit()
        with self.assertRaises(sqlite3.IntegrityError):
            migrate(self.source, apply=True, target_path=self.target, backup_dir=self.backups)
        with connection(path=self.target) as db:
            self.assertEqual(db.columns("game_profiles"), set())
        self.assertEqual(len(list(self.backups.glob("*.sqlite3"))), 1)

    def test_split_poker_source_copies_atomic_queue_and_main_cloud_saves(self):
        poker_source = Path(self.folder.name) / "legacy-poker.sqlite3"
        with closing(sqlite3.connect(poker_source)) as db:
            db.executescript("""
                CREATE TABLE poker_rooms(room_id TEXT PRIMARY KEY, payload TEXT);
                CREATE TABLE platform_matchmaking(user_id INTEGER PRIMARY KEY, room_id TEXT);
                CREATE TABLE platform_saves(user_id INTEGER, game TEXT, state TEXT);
            """)
            db.execute("INSERT INTO poker_rooms VALUES ('room-1','{}')")
            db.execute("INSERT INTO platform_matchmaking VALUES (900000000001,'room-1')")
            db.execute("INSERT INTO platform_saves VALUES (2,'chess','wrong database')")
            db.commit()
        report = migrate(self.source, poker_source=poker_source, apply=True,
                         target_path=self.target, backup_dir=self.backups)
        self.assertEqual(len(report["backups"]), 2)
        self.assertEqual(report["tables"]["platform_matchmaking"], 1)
        with connection(path=self.target) as db:
            self.assertEqual(db.execute("SELECT user_id FROM platform_saves").fetchone()[0], 900000000001)
            self.assertEqual(db.execute("SELECT room_id FROM platform_matchmaking").fetchone()[0], "room-1")


class PokerStorageTests(unittest.TestCase):
    def setUp(self):
        self.folder = tempfile.TemporaryDirectory()
        self.path = Path(self.folder.name) / "poker.sqlite3"
        self.env = patch.dict(os.environ, {"DATABASE_URL": "", "POKER_DB_PATH": str(self.path)})
        self.env.start()
        poker.init_poker_db()

    def tearDown(self):
        self.env.stop()
        self.folder.cleanup()

    def online(self):
        created = poker.create_room({"id": 900000000001, "first_name": "Первый"})
        return poker.join_room(poker.JoinRequest(code=created["state"]["code"]), {"id": 900000000002, "first_name": "Второй"})["state"]

    def test_only_winning_cas_publishes_and_no_uncommitted_notifications(self):
        state = self.online()
        barrier = threading.Barrier(2)
        actual = poker._bot_turn
        def both_read(room):
            barrier.wait(timeout=5)
            actual(room)
        def submit(action):
            try:
                poker.act(state["roomId"], poker.ActionRequest(action=action, version=state["version"]), {"userId": 900000000001})
                return 200
            except HTTPException as error:
                return error.status_code
        with patch.object(poker, "_bot_turn", side_effect=both_read), patch.object(poker, "_notify") as notify:
            with ThreadPoolExecutor(max_workers=2) as workers:
                self.assertEqual(sorted(workers.map(submit, ("call", "fold"))), [200, 409])
            self.assertEqual(notify.call_count, 1)
            # The notification observes the newly committed state on another
            # connection, rather than an in-flight transaction.
            committed = poker.get_room(state["roomId"], {"userId": 900000000002})
            self.assertEqual(committed["version"], state["version"] + 1)

    def test_bot_compute_does_not_hold_sqlite_writer_lock(self):
        created = poker.solo(poker.SoloRequest(name="Игрок"), None)
        state = created["state"]
        def other_table_during_compute(room):
            with ThreadPoolExecutor(max_workers=1) as worker:
                future = worker.submit(poker.create_room, {"id": 999, "first_name": "Другая комната"})
                self.assertTrue(future.result(timeout=2)["roomId"])
        with patch.object(poker, "_bot_turn", side_effect=other_table_during_compute):
            poker.act(state["roomId"], poker.ActionRequest(action="call", version=state["version"]),
                      {"tokenHash": poker.hashlib.sha256(created["token"].encode()).hexdigest()})

    def test_expired_turn_folds_once_preserves_chips_and_hides_cards(self):
        state = self.online()
        self.assertGreater(state["turnDeadline"], time.time())
        self.assertIsNone(state["waitingExpiresAt"])
        with patch.object(poker, "_notify") as notify:
            now = state["turnDeadline"] + 1
            self.assertEqual(poker.tick_timeouts(now), 1)
            self.assertEqual(poker.tick_timeouts(now), 0)
            self.assertEqual(notify.call_count, 1)
        current = poker.get_room(state["roomId"], {"userId": 900000000002})
        self.assertEqual(current["phase"], "complete")
        self.assertEqual(current["version"], state["version"] + 1)
        self.assertEqual(current["result"]["reason"], "fold")
        self.assertEqual(sum(p["stack"] + p["committed"] for p in current["players"]), 2000)
        self.assertEqual(current["players"][0]["hole"], [None, None])

    def test_waiting_room_expires_and_list_user_rooms_is_private(self):
        created = poker.create_room({"id": 41, "first_name": "Ожидает"})["state"]
        self.assertGreater(created["waitingExpiresAt"], time.time())
        self.assertEqual(len(poker.list_user_rooms(41)), 1)
        self.assertEqual(poker.list_user_rooms(42), [])
        self.assertEqual(poker.tick_timeouts(created["waitingExpiresAt"] + 1), 1)
        self.assertEqual(poker.list_user_rooms(41), [])
        with self.assertRaises(HTTPException) as error:
            poker.join_room(poker.JoinRequest(code=created["code"]), {"id": 42, "first_name": "Поздно"})
        self.assertEqual(error.exception.status_code, 409)

    def test_match_room_rolls_back_with_outer_transaction(self):
        with self.assertRaisesRegex(RuntimeError, "rollback"), poker._connection(True) as db:
            poker.create_match_room({"id": 1}, {"id": 2}, db)
            raise RuntimeError("rollback")
        self.assertEqual(poker.list_user_rooms(1), [])
        with poker._connection() as db:
            self.assertEqual(db.execute("SELECT COUNT(*) FROM poker_rooms").fetchone()[0], 0)

    def test_restart_does_not_extend_expiry_or_rewrite_room(self):
        state = self.online()
        expires = int(time.time()) + 600
        with poker._connection(True) as db:
            db.execute("UPDATE poker_rooms SET expires_at=? WHERE room_id=?", (expires, state["roomId"]))
            before = tuple(db.execute("SELECT payload,expires_at FROM poker_rooms WHERE room_id=?", (state["roomId"],)).fetchone())
        poker.init_poker_db()
        with poker._connection() as db:
            after = tuple(db.execute("SELECT payload,expires_at FROM poker_rooms WHERE room_id=?", (state["roomId"],)).fetchone())
            self.assertEqual(db.execute("SELECT COUNT(*) FROM poker_room_members").fetchone()[0], 2)
        self.assertEqual(after, before)


@unittest.skipUnless(os.getenv("TERAMONT_TEST_POSTGRES_URL"), "Set TERAMONT_TEST_POSTGRES_URL to an isolated test database")
class PostgreSQLTests(unittest.TestCase):
    """Each test owns a fresh schema; existing deployment tables are untouched."""
    def setUp(self):
        import psycopg
        from psycopg import sql
        self.url = os.environ["TERAMONT_TEST_POSTGRES_URL"]
        self.schema = "storage_test_" + uuid.uuid4().hex
        with psycopg.connect(self.url) as raw:
            raw.execute(sql.SQL("CREATE SCHEMA {}").format(sql.Identifier(self.schema)))
        parts = urlsplit(self.url)
        query = dict(parse_qsl(parts.query))
        query["options"] = "-csearch_path=" + self.schema
        self.scoped_url = urlunsplit(parts._replace(query=urlencode(query)))
        self.env = patch.dict(os.environ, {"DATABASE_URL": self.scoped_url, "POKER_DB_PATH": "", "DATABASE_POOL_SIZE": "0"})
        self.env.start()

    def tearDown(self):
        import psycopg
        from psycopg import sql
        close_pools()
        self.env.stop()
        with psycopg.connect(self.url) as raw:
            raw.execute(sql.SQL("DROP SCHEMA {} CASCADE").format(sql.Identifier(self.schema)))

    def test_bigint_translation_rows_ignore_and_rollback(self):
        with connection(write=True) as db:
            db.executescript("CREATE TABLE profiles (user_id INTEGER PRIMARY KEY, name TEXT);")
            db.execute("INSERT INTO profiles VALUES (?,?)", (900000000001, "50%? 'Тест'"))
            db.execute("INSERT OR IGNORE INTO profiles VALUES (?,?)", (900000000001, "ignored"))
            self.assertEqual(db.columns("profiles"), {"user_id", "name"})
            self.assertEqual(db.execute("SELECT name FROM profiles WHERE user_id=?", (900000000001,)).fetchone()[0], "50%? 'Тест'")
            self.assertEqual(db.execute("SELECT '50%?' AS literal WHERE 1=?", (1,)).fetchone()["literal"], "50%?")
            self.assertEqual(db.execute("SELECT data_type FROM information_schema.columns WHERE table_schema=current_schema() AND table_name='profiles' AND column_name='user_id'").fetchone()[0], "bigint")
        with self.assertRaises(RuntimeError), connection(write=True) as db:
            db.execute("UPDATE profiles SET name='lost'")
            raise RuntimeError("rollback")
        with connection() as db:
            self.assertEqual(db.execute("SELECT name FROM profiles").fetchone()[0], "50%? 'Тест'")

    def test_poker_same_version_cas_and_deadline_on_postgres(self):
        poker.init_poker_db()
        with connection(write=True) as db:
            state = poker.create_match_room({"id": 900000000001}, {"id": 900000000002}, db)
        barrier = threading.Barrier(2)
        def submit(action):
            try:
                poker.act(state["roomId"], poker.ActionRequest(action=action, version=state["version"]), {"userId": 900000000001})
                return 200
            except HTTPException as error:
                return error.status_code
        with patch.object(poker, "_bot_turn", side_effect=lambda room: barrier.wait(timeout=5)):
            with ThreadPoolExecutor(max_workers=2) as workers:
                self.assertEqual(sorted(workers.map(submit, ("call", "fold"))), [200, 409])
        current = poker.get_room(state["roomId"], {"userId": 900000000001})
        self.assertEqual(current["version"], state["version"] + 1)
        if current["phase"] == "playing":
            self.assertEqual(poker.tick_timeouts(current["turnDeadline"] + 1), 1)
        self.assertEqual(len(poker.list_user_rooms(900000000002)), 1)

    def test_complete_sqlite_snapshot_migrates_to_postgres(self):
        from webapp.backend import game_store, platform
        with tempfile.TemporaryDirectory() as folder:
            source = Path(folder) / "source.sqlite3"
            user = {"id": 900000000001, "first_name": "Перенос"}
            with patch.dict(os.environ, {"DATABASE_URL": "", "GAME_DB_PATH": str(source), "POKER_DB_PATH": ""}):
                game_store.init_database()
                poker.init_poker_db()
                platform.init_platform_db()
                game_store.get_profile(user)
                created = poker.create_room(user)
            report = migrate(source, apply=True, backup_dir=Path(folder) / "backups")
            self.assertTrue(report["verified"])
            self.assertEqual(report["tables"]["game_profiles"], 1)
            self.assertEqual(report["tables"]["poker_rooms"], 1)
            with connection() as db:
                self.assertEqual(db.execute("SELECT first_name FROM game_profiles WHERE user_id=?", (user["id"],)).fetchone()[0], "Перенос")
            self.assertEqual(poker.list_user_rooms(user["id"])[0]["roomId"], created["roomId"])
            with self.assertRaisesRegex(ValueError, "not empty"):
                migrate(source, apply=True, backup_dir=Path(folder) / "backups")

    def test_pool_reuses_connections_rolls_back_and_closes_resources(self):
        from webapp.backend.database import _get_pool
        with patch.dict(os.environ, {"DATABASE_POOL_SIZE": "2"}):
            with connection(write=True) as db:
                db.execute("CREATE TABLE pool_check (id INTEGER PRIMARY KEY)")
                first_pid = db.execute("SELECT pg_backend_pid()").fetchone()[0]
                raw = db.raw
            self.assertFalse(raw.closed, "Returning a connection must not close its backend")
            with connection() as db:
                self.assertEqual(db.execute("SELECT pg_backend_pid()").fetchone()[0], first_pid)
            with self.assertRaisesRegex(RuntimeError, "rollback"), connection(write=True) as db:
                db.execute("INSERT INTO pool_check VALUES (1)")
                raise RuntimeError("rollback")
            with connection() as db:
                self.assertEqual(db.execute("SELECT COUNT(*) FROM pool_check").fetchone()[0], 0)
                self.assertEqual(db.execute("SELECT pg_backend_pid()").fetchone()[0], first_pid)
            pool = _get_pool(self.scoped_url, 2)
            close_pools()
            self.assertTrue(pool.closed)
            self.assertTrue(raw.closed)
            with connection() as db:
                self.assertNotEqual(db.execute("SELECT pg_backend_pid()").fetchone()[0], first_pid)

    def test_pool_bounds_concurrent_connections_and_checks_broken_idle_backend(self):
        gate = threading.Lock()
        active, peak = 0, 0
        def work(_):
            nonlocal active, peak
            with connection() as db:
                with gate:
                    active += 1
                    peak = max(peak, active)
                pid = db.execute("SELECT pg_backend_pid()").fetchone()[0]
                time.sleep(0.03)
                with gate:
                    active -= 1
                return pid
        with patch.dict(os.environ, {"DATABASE_POOL_SIZE": "2"}):
            with ThreadPoolExecutor(max_workers=8) as workers:
                pids = list(workers.map(work, range(16)))
            self.assertEqual(peak, 2)
            self.assertLessEqual(len(set(pids)), 2)
            close_pools()
            # There is now exactly one idle backend. Simulate its loss between
            # requests; the configured health check replaces it before use.
            with connection() as db:
                old = db.execute("SELECT pg_backend_pid()").fetchone()[0]
                raw = db.raw
            raw.close()
            with connection() as db:
                self.assertNotEqual(db.execute("SELECT pg_backend_pid()").fetchone()[0], old)
                self.assertEqual(db.execute("SELECT 1").fetchone()[0], 1)


if __name__ == "__main__":
    unittest.main()
