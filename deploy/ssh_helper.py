"""
SSH-helper для деплоя Teramont games на VPS. Адаптация паттерна из trader/music-ai.

Креды читаются из deploy/.env либо из env vars RAZVIVAYKA_SSH_HOST / USER / PASSWORD / KEY_PATH.

Использование:
    python deploy/ssh_helper.py test               — проверка коннекта
    python deploy/ssh_helper.py exec "<команда>"    — выполнить команду на VPS
    python deploy/ssh_helper.py upload <local> <remote>  — залить файл

Зависимость: paramiko (pip install paramiko).
"""
from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

try:
    import paramiko
except ImportError:  # pragma: no cover
    print("Install: pip install paramiko", file=sys.stderr)
    sys.exit(1)


def _load_env() -> None:
    env_file = Path(__file__).parent / ".env"
    if not env_file.exists():
        return
    for line in env_file.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))


def _ssh_client() -> paramiko.SSHClient:
    _load_env()
    host = os.environ.get("RAZVIVAYKA_SSH_HOST")
    user = os.environ.get("RAZVIVAYKA_SSH_USER", "root")
    pwd = os.environ.get("RAZVIVAYKA_SSH_PASSWORD")
    key = os.environ.get("RAZVIVAYKA_SSH_KEY_PATH")

    if not host:
        raise RuntimeError("RAZVIVAYKA_SSH_HOST not set (in deploy/.env or env vars)")

    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())

    if key and Path(key).exists():
        client.connect(host, username=user, key_filename=key, timeout=15)
    elif pwd:
        client.connect(host, username=user, password=pwd, timeout=15, allow_agent=False, look_for_keys=False)
    else:
        raise RuntimeError("ни ключ (RAZVIVAYKA_SSH_KEY_PATH), ни пароль (RAZVIVAYKA_SSH_PASSWORD) не заданы")
    return client


def cmd_test() -> int:
    with _ssh_client() as c:
        _, stdout, _ = c.exec_command("hostname && uname -a && docker --version")
        print(stdout.read().decode("utf-8", errors="replace"))
    return 0


def cmd_exec(command: str) -> int:
    with _ssh_client() as c:
        _, stdout, stderr = c.exec_command(command)
        out = stdout.read().decode("utf-8", errors="replace")
        err = stderr.read().decode("utf-8", errors="replace")
        if out:
            print(out, end="")
        if err:
            print(err, file=sys.stderr, end="")
        return stdout.channel.recv_exit_status()


def cmd_upload(local: str, remote: str) -> int:
    """Заливка через base64-over-exec — обход сломанной SFTP на этом VPS (см. music-ai/trader)."""
    import base64
    local_path = Path(local)
    if not local_path.exists():
        print(f"local file not found: {local}", file=sys.stderr)
        return 1
    data = local_path.read_bytes()
    b64 = base64.b64encode(data).decode("ascii")

    remote_path = Path(remote).as_posix()
    parent = str(Path(remote_path).parent)

    with _ssh_client() as c:
        # mkdir -p
        c.exec_command(f"mkdir -p {parent}")
        # base64 → file
        stdin, stdout, _ = c.exec_command(f"base64 -d > {remote_path}")
        stdin.write(b64)
        stdin.channel.shutdown_write()
        return stdout.channel.recv_exit_status()


def main() -> None:
    parser = argparse.ArgumentParser()
    sub = parser.add_subparsers(dest="cmd", required=True)
    sub.add_parser("test")
    p_exec = sub.add_parser("exec")
    p_exec.add_argument("command")
    p_up = sub.add_parser("upload")
    p_up.add_argument("local")
    p_up.add_argument("remote")
    args = parser.parse_args()

    if args.cmd == "test":
        sys.exit(cmd_test())
    elif args.cmd == "exec":
        sys.exit(cmd_exec(args.command))
    elif args.cmd == "upload":
        sys.exit(cmd_upload(args.local, args.remote))


if __name__ == "__main__":
    main()


