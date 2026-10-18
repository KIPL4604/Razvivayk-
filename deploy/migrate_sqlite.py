"""Copy an existing SQLite installation into the configured platform database.

Dry run is the default. Stop writers before --apply, keep the backup until the
new deployment is accepted, and point the app back at the source for rollback.
Existing target rows are never overwritten, including when this tool is rerun.
"""
from __future__ import annotations

import argparse
from datetime import datetime, timezone
import json
import os
from pathlib import Path
import re
import sqlite3
import sys
import uuid

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from webapp.backend.database import connection


def _identifier(value: str) -> str:
    if not re.fullmatch(r"[A-Za-z_][A-Za-z_0-9]*", value):
        raise ValueError("Unsupported table or column identifier")
    return '"' + value + '"'


def _readonly(path: Path):
    if not path.is_file():
        raise ValueError(f"Source database does not exist: {path}")
    return sqlite3.connect(path.as_uri() + "?mode=ro", uri=True)


def _tables(db, poker_only=False):
    found = {}
    for name, sql in db.execute("SELECT name,sql FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"):
        if name.startswith(("game_", "poker_", "platform_")) and (
                not poker_only or name.startswith("poker_") or name == "platform_matchmaking"):
            _identifier(name)
            found[name] = sql
    return found


def _ordered(tables: dict, databases: dict):
    remaining = set(tables)
    result = []
    while remaining:
        ready = [name for name in sorted(remaining) if not {
            row[2] for row in databases[name].execute(f"PRAGMA foreign_key_list({_identifier(name)})")
        }.intersection(remaining)]
        if not ready:
            raise ValueError("Cyclic foreign keys require a dedicated migration")
        result.extend(ready)
        remaining.difference_update(ready)
    return result


def migrate(source: Path, *, apply=False, target_path: Path | None = None,
            poker_source: Path | None = None, backup_dir: Path | None = None) -> dict:
    source = source.resolve()
    sources = [source] + ([poker_source.resolve()] if poker_source else [])
    if len(sources) != len(set(sources)):
        raise ValueError("Source paths must be distinct")
    if target_path:
        target_path = target_path.resolve()
        if target_path in sources:
            raise ValueError("Source and destination must be different databases")
    elif not os.getenv("DATABASE_URL", "").startswith(("postgres://", "postgresql://")):
        raise ValueError("Set DATABASE_URL for PostgreSQL, or choose --target-sqlite for an isolated copy")
    handles = []
    backups = []
    try:
        tables, databases = {}, {}
        for index, path in enumerate(sources):
            original = _readonly(path)
            handles.append(original)
            current = original
            if apply:
                folder = (backup_dir or ROOT / "runtime" / "backups").resolve()
                folder.mkdir(parents=True, exist_ok=True)
                stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
                backup = folder / f"{path.stem}-{stamp}-{uuid.uuid4().hex[:8]}.sqlite3"
                snapshot = sqlite3.connect(backup)
                try:
                    original.backup(snapshot)
                finally:
                    snapshot.close()
                backups.append(str(backup))
                current = _readonly(backup)
                handles.append(current)
            for name, sql in _tables(current, poker_only=index > 0).items():
                if poker_source and index == 0 and name == "platform_matchmaking":
                    # In split installations the atomic queue is stored next
                    # to its poker rooms, rather than cloud saves/profiles.
                    continue
                if name in tables:
                    raise ValueError(f"Table occurs in two sources: {name}")
                tables[name], databases[name] = sql, current
        if not tables:
            raise ValueError("No game, poker or platform tables found")
        order = _ordered(tables, databases)
        counts = {name: databases[name].execute(f"SELECT COUNT(*) FROM {_identifier(name)}").fetchone()[0]
                  for name in order}
        report = {"mode": "apply" if apply else "dry-run", "tables": counts, "backups": backups}
        if not apply:
            return report
        # Every destination change, including DDL, is one transaction. A failed
        # constraint or non-empty destination rolls it all back.
        with connection(write=True, path=target_path) as destination:
            destination.lock("teramont:migration")
            for name in order:
                declaration = re.sub(r"^CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?", "CREATE TABLE IF NOT EXISTS ",
                                     tables[name], count=1, flags=re.I)
                destination.execute(declaration)
                if destination.execute(f"SELECT COUNT(*) FROM {_identifier(name)}").fetchone()[0]:
                    raise ValueError(f"Destination table is not empty; nothing is overwritten: {name}")
                source_db = databases[name]
                columns = [row[1] for row in source_db.execute(f"PRAGMA table_info({_identifier(name)})")]
                missing = set(columns) - destination.columns(name)
                if missing:
                    raise ValueError(f"Destination schema lacks columns in {name}: {', '.join(sorted(missing))}")
                column_sql = ",".join(_identifier(column) for column in columns)
                placeholders = ",".join("?" for _ in columns)
                rows = source_db.execute(f"SELECT {column_sql} FROM {_identifier(name)}")
                while batch := rows.fetchmany(500):
                    destination.executemany(f"INSERT INTO {_identifier(name)} ({column_sql}) VALUES ({placeholders})", batch)
                actual = destination.execute(f"SELECT COUNT(*) FROM {_identifier(name)}").fetchone()[0]
                if actual != counts[name]:
                    raise RuntimeError(f"Row-count mismatch in {name}: expected {counts[name]}, got {actual}")
            # Indexes are part of a usable migration, including unique indexes.
            for name in order:
                for (sql,) in databases[name].execute("SELECT sql FROM sqlite_master WHERE type='index' AND tbl_name=? AND sql IS NOT NULL", (name,)):
                    sql = re.sub(r"^(CREATE\s+(?:UNIQUE\s+)?INDEX)\s+(?:IF\s+NOT\s+EXISTS\s+)?", r"\1 IF NOT EXISTS ", sql, count=1, flags=re.I)
                    destination.execute(sql)
        report["verified"] = True
        return report
    finally:
        for handle in handles:
            handle.close()


def main():
    from config_env import load_env
    load_env()
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=Path, required=True)
    parser.add_argument("--poker-source", type=Path, help="Optional legacy separate poker SQLite file")
    parser.add_argument("--target-sqlite", type=Path, help="Isolated rehearsal destination; PostgreSQL uses DATABASE_URL")
    parser.add_argument("--backup-dir", type=Path)
    parser.add_argument("--apply", action="store_true", help="Back up sources and copy into empty target tables")
    args = parser.parse_args()
    try:
        report = migrate(args.source, apply=args.apply, target_path=args.target_sqlite,
                         poker_source=args.poker_source, backup_dir=args.backup_dir)
    except Exception as error:
        # Drivers can include credentials in connection errors; print only a
        # controlled application error or the exception class.
        detail = str(error) if isinstance(error, ValueError) else type(error).__name__
        print(f"Migration failed: {detail}", file=sys.stderr)
        return 1
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
