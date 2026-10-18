"""Keep API upgrades compatible with the local supervisor's health contract."""
import io
import json
import unittest
from unittest.mock import patch

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
