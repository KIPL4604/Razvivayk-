"""
Синк локального проекта teramont-games на VPS (под /opt/teramont-games/).

Сканирует дерево с exclude-списком (как в trader, не как в music-ai с жёстким списком —
исправляем эту граблю). Файлы заливаются через base64-over-exec (sftp на VPS ломается).

Запуск:
    python deploy/push_files.py
"""
from __future__ import annotations

import base64
import os
import sys
from pathlib import Path

# Импортируем helper из того же пакета
sys.path.insert(0, str(Path(__file__).parent))
import ssh_helper  # noqa: E402


ROOT = Path(__file__).parent.parent
REMOTE_ROOT = "/opt/teramont-games"

EXCLUDE_DIRS = {
    ".git", "__pycache__", ".venv", "venv", ".pytest_cache", ".idea", ".vscode",
    "node_modules", "backups", "logs", "deploy", "runtime", "tests", "output", ".playwright-cli", "design",
}
EXCLUDE_FILES = {
    ".env", ".DS_Store", ".gitignore",
}
EXCLUDE_SUFFIXES = {".pyc", ".pyo", ".log", ".sqlite3", ".sqlite3-wal", ".sqlite3-shm"}


def iter_local_files():
    for dirpath, dirnames, filenames in os.walk(ROOT):
        # mutate dirnames in-place — обходим только нужные
        dirnames[:] = [d for d in dirnames if d not in EXCLUDE_DIRS]
        rel_dir = Path(dirpath).relative_to(ROOT)
        for fn in filenames:
            if fn in EXCLUDE_FILES:
                continue
            if any(fn.endswith(s) for s in EXCLUDE_SUFFIXES):
                continue
            local = Path(dirpath) / fn
            rel = (rel_dir / fn).as_posix()
            yield local, rel


def main() -> None:
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--no-rebuild", action="store_true",
                        help="не делать docker compose up -d --build в конце")
    args = parser.parse_args()

    ok = 0
    failed = 0
    client = ssh_helper._ssh_client()
    try:
        # один общий ssh-канал — быстрее чем по соединению на файл
        for local, rel in iter_local_files():
            remote = f"{REMOTE_ROOT}/{rel}"
            parent = str(Path(remote).parent).replace("\\", "/")
            data = local.read_bytes()
            b64 = base64.b64encode(data).decode("ascii")
            stdin, stdout, _ = client.exec_command(f"mkdir -p '{parent}' && base64 -d > '{remote}'")
            stdin.write(b64)
            stdin.channel.shutdown_write()
            rc = stdout.channel.recv_exit_status()
            if rc == 0:
                print(f"  OK  {remote}")
                ok += 1
            else:
                print(f"  FAIL {remote}", file=sys.stderr)
                failed += 1
        if failed == 0 and not args.no_rebuild:
            sys.stdout.write("\n=> rebuild api+bot containers...\n")
            sys.stdout.flush()
            stdin, stdout, _ = client.exec_command(
                f"cd {REMOTE_ROOT} && docker compose up -d --build api bot 2>&1 | tail -3"
            )
            out = stdout.read().decode("utf-8", errors="replace")
            # Print ASCII-safe (Windows cp1251 console)
            sys.stdout.buffer.write(out.encode("utf-8", errors="replace"))
            sys.stdout.write("\n")
    finally:
        client.close()
    print(f"\n{ok} files pushed, {failed} failed")
    sys.exit(0 if failed == 0 else 1)


if __name__ == "__main__":
    main()


