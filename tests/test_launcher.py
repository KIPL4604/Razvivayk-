"""Keep API upgrades compatible with the local supervisor's health contract."""
import io
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import Mock, patch

import run_local
from run_local import health
from webapp.backend.main import health as api_health


class LauncherHealthTests(unittest.TestCase):
    def probe(self, data):
        with patch("run_local.urllib.request.urlopen", return_value=io.BytesIO(json.dumps(data).encode())):
            return health("http://127.0.0.1:8080")

    def test_current_api_health_is_accepted(self):
        with patch.dict("os.environ", {"TG_BOT_TOKEN": "local-health-test"}):
            self.assertTrue(self.probe(api_health()))

    def test_later_version_does_not_trigger_restart_loop(self):
        self.assertTrue(self.probe({"service": "teramont", "ok": True, "version": "5.0.0", "telegramAuthConfigured": True}))

    def test_other_service_or_unconfigured_bot_is_not_accepted(self):
        self.assertFalse(self.probe({"service": "other", "ok": True, "telegramAuthConfigured": True}))
        self.assertFalse(self.probe({"service": "teramont", "ok": True, "telegramAuthConfigured": False}))
        self.assertFalse(self.probe({"service": "teramont", "ok": False, "telegramAuthConfigured": True}))

    def test_network_error_reports_unhealthy(self):
        with patch("run_local.urllib.request.urlopen", side_effect=OSError("offline")):
            self.assertFalse(health("http://127.0.0.1:8080"))


class LauncherTunnelTests(unittest.TestCase):
    def launch_once(self, root, environment):
        stop = root / 'stop-request'
        process = Mock(pid=1234, stdout=io.StringIO(''))
        process.poll.return_value = None
        probe = Mock()
        probe.__enter__ = Mock(return_value=probe)
        probe.__exit__ = Mock(return_value=False)
        probe.connect_ex.return_value = 1

        def connect(*args, **kwargs):
            stop.touch()
            return process

        with patch.dict('os.environ', {'TG_BOT_TOKEN': 'launcher-test', **environment}, clear=True), \
                patch.object(run_local, 'load_env'), \
                patch.object(run_local, 'ROOT', root), \
                patch.object(run_local, 'RUNTIME', root), \
                patch.object(run_local, 'STOP', stop), \
                patch.object(run_local, 'health', return_value=True), \
                patch.object(run_local, 'atomic_json', return_value=True), \
                patch.object(run_local.logging, 'basicConfig'), \
                patch.object(run_local, 'RotatingFileHandler'), \
                patch.object(run_local, 'start_service', return_value=process), \
                patch.object(run_local, 'stop_child'), \
                patch.object(run_local.socket, 'socket', return_value=probe), \
                patch.object(run_local.subprocess, 'Popen', side_effect=connect) as popen:
            run_local.run()
            return popen.call_args.args[0]

    def test_registered_identity_replaces_anonymous_tunnel(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            key = root / 'tunnel_ed25519'
            key.touch()
            command = self.launch_once(root, {'TUNNEL_SSH_KEY': 'tunnel_ed25519'})
            self.assertNotIn('nokey@localhost.run', command)
            self.assertNotIn('IdentityFile=none', command)
            self.assertIn(str(key), command)
            self.assertIn('tunnel@localhost.run', command)

    def test_missing_configured_key_does_not_fall_back_to_anonymous(self):
        with tempfile.TemporaryDirectory() as directory:
            with self.assertRaisesRegex(RuntimeError, 'TUNNEL_SSH_KEY'):
                self.launch_once(Path(directory), {'TUNNEL_SSH_KEY': 'missing-key'})
