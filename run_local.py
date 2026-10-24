"""Run API, a temporary HTTPS tunnel and bot together; recover lost processes/links."""
from __future__ import annotations
import argparse
from contextlib import contextmanager
from collections import deque
import json
import logging
from logging.handlers import RotatingFileHandler
import os
from pathlib import Path
import queue
import re
import socket
import subprocess
import sys
import threading
import time
import urllib.request

from config_env import ROOT, load_env

RUNTIME = ROOT / 'runtime'
STATE = RUNTIME / 'launch.json'
URL_FILE = RUNTIME / 'public-url.json'
STOP = RUNTIME / 'stop-request'
PORT = 8080
FLAGS = subprocess.CREATE_NO_WINDOW if os.name == 'nt' else 0


@contextmanager
def launcher_lock():
    RUNTIME.mkdir(exist_ok=True)
    with open(RUNTIME / 'launcher.lock', 'a+b') as handle:
        handle.seek(0, 2)
        if handle.tell() == 0:
            handle.write(b'0')
            handle.flush()
        handle.seek(0)
        try:
            if os.name == 'nt':
                import msvcrt
                msvcrt.locking(handle.fileno(), msvcrt.LK_NBLCK, 1)
            else:
                import fcntl
                fcntl.flock(handle, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except OSError:
            print('Launcher already running.')
            yield False
            return
        try:
            yield True
        finally:
            handle.seek(0)
            if os.name == 'nt':
                msvcrt.locking(handle.fileno(), msvcrt.LK_UNLCK, 1)
            else:
                fcntl.flock(handle, fcntl.LOCK_UN)


def atomic_json(path: Path, value: dict) -> bool:
    temporary = path.with_suffix(f'.{os.getpid()}.new')
    temporary.write_text(json.dumps(value, ensure_ascii=False), encoding='utf-8')
    for _ in range(20):
        try:
            temporary.replace(path)
            return True
        except PermissionError:
            time.sleep(.1)
    logging.warning('File temporarily locked: %s', path.name)
    return False


def health(url: str) -> bool:
    try:
        with urllib.request.urlopen(url.rstrip('/') + '/healthz', timeout=6) as response:
            data = json.load(response)
            return data.get('service') == 'teramont' and data.get('ok') is True and data.get('telegramAuthConfigured') is True
    except Exception:
        return False


def start_service(name: str, args: list[str], env: dict) -> subprocess.Popen:
    output = open(RUNTIME / (name + '.log'), 'ab', buffering=0)
    try:
        process = subprocess.Popen(args, cwd=ROOT, env=env, stdin=subprocess.DEVNULL,
                                   stdout=output, stderr=subprocess.STDOUT, creationflags=FLAGS)
    finally:
        output.close()
    logging.info('%s started, PID %s', name, process.pid)
    return process


def stop_child(process: subprocess.Popen | None) -> None:
    if process is not None and process.poll() is None:
        process.terminate()
        try:
            process.wait(timeout=6)
        except subprocess.TimeoutExpired:
            process.kill()
            process.wait(timeout=3)


def tunnel_reader(process, lines):
    for line in process.stdout:
        lines.put(line)
    lines.put(None)


def run():
    load_env()
    if not os.getenv('TG_BOT_TOKEN'):
        raise RuntimeError('Set TG_BOT_TOKEN in .env')
    RUNTIME.mkdir(exist_ok=True)
    with socket.socket() as probe:
        if probe.connect_ex(('127.0.0.1', PORT)) == 0:
            raise RuntimeError('Port 8080 is already used. Stop the previous API before starting this launcher.')
    STOP.unlink(missing_ok=True)
    logging.basicConfig(level=logging.INFO, handlers=[RotatingFileHandler(RUNTIME/'launcher.log', maxBytes=1_000_000, backupCount=1, encoding='utf-8')], format='%(asctime)s %(levelname)s %(message)s')
    env = dict(os.environ, PUBLIC_URL_FILE=str(URL_FILE), PYTHONUNBUFFERED='1')
    api = bot = tunnel = None
    lines = queue.Queue()
    current_url = candidate = ''
    errors = deque(maxlen=4)
    next_connect = next_candidate_check = next_health_check = 0.0
    connect_delay = 2
    tunnel_started = 0.0
    tunnel_ready = False
    public_failures = local_failures = 0
    reconnects = 0
    last_public_health = None
    try:
        api = start_service('api', [sys.executable,'-m','uvicorn','webapp.backend.main:app','--host','127.0.0.1','--port',str(PORT),'--no-access-log'], env)
        deadline = time.monotonic()+25
        while not health(f'http://127.0.0.1:{PORT}'):
            if api.poll() is not None or time.monotonic()>deadline:
                raise RuntimeError('API startup failed; see runtime/api.log')
            time.sleep(.4)
        while not STOP.exists():
            now = time.monotonic()
            if api.poll() is not None:
                api = start_service('api',[sys.executable,'-m','uvicorn','webapp.backend.main:app','--host','127.0.0.1','--port',str(PORT),'--no-access-log'],env)
            if tunnel is not None and tunnel.poll() is not None:
                logging.warning('Tunnel exited; reconnecting in %s seconds', connect_delay)
                tunnel = None
                tunnel_ready = False
                candidate = ''
                lines = queue.Queue()
                next_connect = now + connect_delay
                connect_delay = min(30, connect_delay * 2)
                reconnects += 1
            if tunnel is None and now >= next_connect:
                lines = queue.Queue()
                tunnel = subprocess.Popen(['ssh','-T','-o','StrictHostKeyChecking=accept-new','-o',f'UserKnownHostsFile={RUNTIME / "tunnel_known_hosts"}',
                    '-o','IdentityFile=none','-o','IdentitiesOnly=yes','-o','PasswordAuthentication=no','-o','KbdInteractiveAuthentication=no',
                    '-o','ConnectTimeout=15','-o','ExitOnForwardFailure=yes','-o','ServerAliveInterval=20','-o','ServerAliveCountMax=3',
                    '-R',f'80:127.0.0.1:{PORT}','nokey@localhost.run','--','--output','json'],
                    cwd=ROOT,stdin=subprocess.DEVNULL,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True,encoding='utf-8',errors='replace',creationflags=FLAGS)
                threading.Thread(target=tunnel_reader,args=(tunnel,lines),daemon=True).start()
                tunnel_started = now
                logging.info('Tunnel connecting, PID %s', tunnel.pid)
            try:
                line = lines.get(timeout=2)
            except queue.Empty:
                line = ''
            if line:
                if '\x1b' not in line and line.strip():
                    logging.info('Tunnel event: %s',line.strip()[:300])
                matches = re.findall(r'(?:https://)?([a-zA-Z0-9-]+\.(?:lhr\.life|localhost\.run))',line)
                matches = [host for host in matches if host.split('.')[0] not in ('docs','admin','cd')]
                if matches:
                    candidate = 'https://' + matches[-1]
                elif 'error' in line.lower():
                    errors.append(line.strip()[:180])
            # localhost.run can register a replacement hostname on the same SSH
            # connection. Publish it as soon as it answers instead of waiting for
            # three failures on the previous hostname and killing a healthy tunnel.
            if tunnel is not None and tunnel.poll() is None and candidate and (not tunnel_ready or candidate != current_url) and now >= next_candidate_check:
                next_candidate_check = now + 5
                if health(candidate):
                    if atomic_json(URL_FILE,{'url':candidate,'updatedAt':time.time()}):
                        current_url = candidate
                        env['APP_URL'] = current_url
                        tunnel_ready = True
                        public_failures = 0
                        connect_delay = 2
                        next_health_check = now + 20
                        last_public_health = time.time()
                        logging.info('Public HTTPS ready: %s',current_url)
            if tunnel is not None and not tunnel_ready and now - tunnel_started >= 60:
                logging.warning('Tunnel did not become reachable within 60 seconds; reconnecting')
                stop_child(tunnel)
            if tunnel_ready and now >= next_health_check:
                next_health_check = now + 20
                if health(f'http://127.0.0.1:{PORT}'):
                    local_failures = 0
                    if health(current_url):
                        public_failures = 0
                        last_public_health = time.time()
                    else:
                        public_failures += 1
                        logging.warning('Public HTTPS check failed (%s/3)', public_failures)
                        if public_failures >= 3:
                            stop_child(tunnel)
                else:
                    local_failures += 1
                    if local_failures >= 3:
                        logging.warning('Local API unresponsive; restarting API')
                        stop_child(api)
                        local_failures = 0
            if current_url and (bot is None or bot.poll() is not None):
                bot = start_service('bot',[sys.executable,'-m','bots.razvivayka.main'],env)
            atomic_json(STATE,{'status':'running','pid':os.getpid(),'apiPid':api.pid,'tunnelPid':tunnel.pid if tunnel else None,'botPid':bot.pid if bot else None,'url':current_url,'tunnelStatus':'online' if tunnel_ready else 'reconnecting','reconnects':reconnects,'publicHealthFailures':public_failures,'lastPublicHealthAt':last_public_health,'updatedAt':time.time(),'recentTunnelErrors':list(errors)})
            if line is None:
                time.sleep(2)
    finally:
        for process in (bot,tunnel,api):
            stop_child(process)
        atomic_json(STATE,{'status':'stopped','updatedAt':time.time()})


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--stop',action='store_true')
    parser.add_argument('--status',action='store_true')
    args = parser.parse_args()
    if args.stop:
        RUNTIME.mkdir(exist_ok=True)
        STOP.touch()
        print('Stop requested.')
    elif args.status:
        print(STATE.read_text(encoding='utf-8') if STATE.exists() else 'Not started.')
    else:
        try:
            with launcher_lock() as acquired:
                if acquired:
                    run()
        except KeyboardInterrupt:
            raise SystemExit(0)
