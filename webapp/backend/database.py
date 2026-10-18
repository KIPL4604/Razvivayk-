"""Small DB-API seam for SQLite development and PostgreSQL deployment.

SQL remains parameterized with ``?`` placeholders at application call sites.
This adapter deliberately does not attempt to be an ORM or a general SQL parser.
"""
from __future__ import annotations

from contextlib import contextmanager
import hashlib
import logging
import os
from pathlib import Path
import re
import sqlite3
import threading


_pools = {}
_pools_lock = threading.Lock()


class _PoolLogFilter(logging.Filter):
    """Driver diagnostics must not turn a configured DSN into a log secret."""
    def filter(self, record):
        message = record.getMessage()
        message = re.sub(r"postgres(?:ql)?://[^\s]+", "[redacted database URL]", message, flags=re.I)
        message = re.sub(r"\bpassword\s*=\s*(?:'[^']*'|\"[^\"]*\"|[^\s]+)",
                         "password=[redacted]", message, flags=re.I)
        record.msg, record.args = message, ()
        record.exc_info = None
        record.exc_text = None
        return True


_pool_log_filter = _PoolLogFilter()


def _pool_size() -> int:
    try:
        size = int(os.getenv("DATABASE_POOL_SIZE", "0"))
    except ValueError:
        raise RuntimeError("DATABASE_POOL_SIZE must be an integer") from None
    # Startup holds one schema-lock connection while individual modules open
    # another connection, so an enabled pool must have at least two slots.
    return min(50, max(2, size)) if size > 0 else 0


def _get_pool(url: str, size: int):
    try:
        from psycopg_pool import ConnectionPool
    except ImportError:
        raise RuntimeError("PostgreSQL pooling requires the psycopg_pool dependency") from None
    key = (os.getpid(), url, size)
    with _pools_lock:
        pool = _pools.get(key)
        if pool is not None and not pool.closed:
            return pool
        logging.getLogger("psycopg.pool").addFilter(_pool_log_filter)
        pool = None
        try:
            pool = ConnectionPool(
                conninfo=url, min_size=1, max_size=size, open=False,
                kwargs={"connect_timeout": 10}, timeout=10, max_waiting=256,
                reconnect_timeout=10, check=ConnectionPool.check_connection,
                name=f"teramont-{os.getpid()}-{len(_pools) + 1}")
            pool.open(wait=True, timeout=10)
        except Exception:
            if pool is not None:
                pool.close(timeout=1)
            # Connection errors may include the DSN; the application exception
            # exposes only a controlled description, never the URL or secrets.
            raise RuntimeError("PostgreSQL connection pool is unavailable") from None
        _pools[key] = pool
        return pool


def close_pools() -> None:
    """Release this process's pools during application lifespan shutdown."""
    process = os.getpid()
    with _pools_lock:
        owned = [key for key in _pools if key[0] == process]
        pools = [_pools.pop(key) for key in owned]
    for pool in pools:
        pool.close(timeout=10)


class Row:
    """A result row with both sqlite.Row-style names and positional access."""

    def __init__(self, values, names):
        self._values = tuple(values)
        self._names = tuple(names)
        self._indices = {name: index for index, name in enumerate(names)}

    def __getitem__(self, key):
        return self._values[self._indices[key] if isinstance(key, str) else key]

    def __iter__(self):
        return iter(self._values)

    def __len__(self):
        return len(self._values)

    def keys(self):
        return list(self._names)


class Result:
    def __init__(self, cursor):
        self.cursor = cursor
        self._names = [column[0] for column in cursor.description] if cursor.description else []

    @property
    def rowcount(self):
        return self.cursor.rowcount

    def fetchone(self):
        value = self.cursor.fetchone()
        return Row(value, self._names) if value is not None else None

    def fetchall(self):
        return [Row(value, self._names) for value in self.cursor.fetchall()]

    def __iter__(self):
        for value in self.cursor:
            yield Row(value, self._names)


def _statements(source: str):
    """Split our DDL scripts without splitting inside quoted SQL literals."""
    start = 0
    quoted = None
    index = 0
    while index < len(source):
        char = source[index]
        if quoted:
            if char == quoted:
                if index + 1 < len(source) and source[index + 1] == quoted:
                    index += 1
                else:
                    quoted = None
        elif char in ("'", '"'):
            quoted = char
        elif char == ";":
            if statement := source[start:index].strip():
                yield statement
            start = index + 1
        index += 1
    if statement := source[start:].strip():
        yield statement


def _postgres_sql(source: str) -> str:
    """Translate the small portable subset used by the application."""
    ignore = bool(re.match(r"\s*INSERT\s+OR\s+IGNORE\b", source, re.I))
    source = re.sub(r"\bINSERT\s+OR\s+IGNORE\b", "INSERT", source, flags=re.I)
    # All persisted integers fit signed 64 bits, including Telegram identifiers.
    if re.match(r"\s*(CREATE|ALTER)\b", source, re.I):
        source = re.sub(r"\bINTEGER\b", "BIGINT", source, flags=re.I)
    result = []
    quoted = None
    index = 0
    while index < len(source):
        char = source[index]
        if quoted:
            result.append("%%" if char == "%" else char)
            if char == quoted:
                if index + 1 < len(source) and source[index + 1] == quoted:
                    result.append(source[index + 1])
                    index += 1
                else:
                    quoted = None
        elif char in ("'", '"'):
            quoted = char
            result.append(char)
        elif char == "?":
            result.append("%s")
        elif char == "%":
            result.append("%%")
        else:
            result.append(char)
        index += 1
    statement = "".join(result).rstrip().rstrip(";")
    if ignore:
        statement += " ON CONFLICT DO NOTHING"
    return statement


class Database:
    def __init__(self, raw, dialect: str, write: bool):
        self.raw = raw
        self.dialect = dialect
        self.in_write = write

    def execute(self, sql: str, parameters=()):
        if self.dialect == "postgres":
            sql = _postgres_sql(sql)
        return Result(self.raw.execute(sql, parameters))

    def executemany(self, sql: str, parameters):
        if self.dialect == "postgres":
            cursor = self.raw.cursor()
            cursor.executemany(_postgres_sql(sql), parameters)
        else:
            cursor = self.raw.executemany(sql, parameters)
        return Result(cursor)

    def executescript(self, source: str):
        # sqlite3.executescript commits an open transaction; use individual DDL
        # statements instead so schema/data migrations retain rollback behavior.
        for statement in _statements(source):
            self.execute(statement)

    def lock(self, key: str):
        if not self.in_write:
            raise RuntimeError("Transaction locks require connection(write=True)")
        if self.dialect == "postgres":
            number = int.from_bytes(hashlib.sha256(str(key).encode()).digest()[:8], "big", signed=True)
            self.execute("SELECT pg_advisory_xact_lock(?)", (number,))

    def columns(self, table: str) -> set[str]:
        if not re.fullmatch(r"[a-zA-Z_][a-zA-Z_0-9]*", table):
            raise ValueError("Invalid table identifier")
        if self.dialect == "postgres":
            return {row[0] for row in self.execute(
                "SELECT column_name FROM information_schema.columns WHERE table_schema=current_schema() AND table_name=?",
                (table,))}
        return {row[1] for row in self.execute(f'PRAGMA table_info("{table}")')}


@contextmanager
def connection(write: bool = False, path: str | Path | None = None):
    """Open one short transaction; explicit paths select an isolated SQLite DB."""
    url = os.getenv("DATABASE_URL", "").strip() if path is None else ""
    if url and not url.startswith(("postgres://", "postgresql://")):
        raise RuntimeError("DATABASE_URL must use postgres:// or postgresql://")
    pool = None
    if url:
        try:
            import psycopg
        except ImportError as error:
            raise RuntimeError("PostgreSQL requires the psycopg dependency") from error
        if size := _pool_size():
            pool = _get_pool(url, size)
            try:
                raw = pool.getconn(timeout=10)
            except Exception:
                raise RuntimeError("PostgreSQL connection pool is busy or unavailable") from None
        else:
            raw = psycopg.connect(url, connect_timeout=10)
        dialect = "postgres"
    else:
        target = Path(path or os.getenv("GAME_DB_PATH", "runtime/teramont.sqlite3")).resolve()
        target.parent.mkdir(parents=True, exist_ok=True)
        raw = sqlite3.connect(target, timeout=15, isolation_level=None)
        raw.execute("PRAGMA foreign_keys=ON")
        raw.execute("PRAGMA busy_timeout=15000")
        # WAL belongs outside the transaction; concurrent startups tolerate it.
        raw.execute("PRAGMA journal_mode=WAL")
        if write:
            raw.execute("BEGIN IMMEDIATE")
        dialect = "sqlite"
    try:
        yield Database(raw, dialect, write)
        if write or dialect == "postgres":
            raw.commit()
    except BaseException:
        try:
            raw.rollback()
        except Exception:
            # A connection lost during a transaction cannot be rolled back.
            # Preserve the original failure and let the pool discard it.
            pass
        raise
    finally:
        if pool is not None:
            pool.putconn(raw)
        else:
            raw.close()
