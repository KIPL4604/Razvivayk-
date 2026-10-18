"""Rehearse a PostgreSQL dump in a NEW database, never over the running database."""
import argparse
import json
from pathlib import Path
import re
import subprocess
import uuid


def rehearse(container: str, database: str, user: str, output: Path) -> dict:
    for value in (container, database, user):
        if not re.fullmatch(r"[A-Za-z0-9_-]+", value):
            raise ValueError("Use simple container/database/user identifiers")
    restore = "teramont_restore_" + uuid.uuid4().hex
    output.mkdir(parents=True, exist_ok=True)
    target = output / (restore + ".dump")
    prefix = ["docker", "exec", "-i", container]
    def sql(db, statement):
        return subprocess.check_output(prefix + ["psql", "-U", user, "-d", db, "-v", "ON_ERROR_STOP=1", "-Atc", statement], text=True).strip()
    tables_sql = "SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename"
    tables = sql(database, tables_sql).splitlines()
    if not tables:
        raise ValueError("Source database has no public tables; start the isolated platform first")
    for table in tables:
        if not re.fullmatch(r"[A-Za-z_][A-Za-z0-9_]*", table):
            raise ValueError("Unsupported source table")
    counts = {table: int(sql(database, f'SELECT COUNT(*) FROM "{table}"')) for table in tables}
    with target.open("xb") as stream:
        subprocess.run(prefix + ["pg_dump", "-U", user, "-d", database, "--format=custom", "--no-owner"], stdout=stream, check=True)
    sql(database, f'CREATE DATABASE "{restore}"')
    try:
        with target.open("rb") as stream:
            subprocess.run(prefix + ["pg_restore", "-U", user, "-d", restore, "--no-owner", "--exit-on-error"], stdin=stream, check=True)
        restored = {table: int(sql(restore, f'SELECT COUNT(*) FROM "{table}"')) for table in tables}
        if restored != counts:
            raise RuntimeError("Restored row counts differ from the source snapshot")
        return {"ok": True, "tables": counts, "bytes": target.stat().st_size, "backup": str(target), "restoredIntoNewDatabase": True}
    finally:
        # This name is generated here and CREATE above succeeded; it can never
        # resolve to the original application database.
        sql(database, f'DROP DATABASE "{restore}"')


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--container", required=True)
    parser.add_argument("--database", required=True)
    parser.add_argument("--user", required=True)
    parser.add_argument("--output", type=Path, default=Path("runtime/backups"))
    args = parser.parse_args()
    print(json.dumps(rehearse(args.container, args.database, args.user, args.output), ensure_ascii=False, indent=2))
