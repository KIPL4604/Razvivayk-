import os
import unittest
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

from aiogram.exceptions import TelegramNetworkError
from aiogram.methods import GetMe
from bots.razvivayka import main as entry


class TransportTests(unittest.TestCase):
    def test_system_https_proxy_is_used(self):
        with patch.dict(os.environ, {}, clear=True), patch.object(entry, 'getproxies', return_value={'https': 'http://localhost:10801'}), patch.object(entry, 'proxy_bypass', return_value=False), patch.object(entry, 'AiohttpSession') as session:
            entry.bot_session()
            session.assert_called_once_with(proxy='http://localhost:10801')

    def test_explicit_direct_overrides_system_proxy(self):
        with patch.dict(os.environ, {'TG_PROXY_URL': 'direct'}), patch.object(entry, 'getproxies') as proxies, patch.object(entry, 'AiohttpSession') as session:
            entry.bot_session()
            session.assert_called_once_with(proxy=None)
            proxies.assert_not_called()

    def test_proxy_bypass_is_respected(self):
        with patch.dict(os.environ, {}, clear=True), patch.object(entry, 'proxy_bypass', return_value=True), patch.object(entry, 'AiohttpSession') as session:
            entry.bot_session()
            session.assert_called_once_with(proxy=None)


class StartReplyTests(unittest.IsolatedAsyncioTestCase):
    async def test_start_reply_precedes_failed_legacy_maintenance(self):
        replies = []

        async def answer(text, **kwargs):
            replies.append((text, kwargs))
            return SimpleNamespace(message_id=900)

        async def cleanup(*args):
            self.assertEqual(len(replies), 2)
            raise TelegramNetworkError(method=GetMe(), message='test unavailable maintenance')

        message = SimpleNamespace(chat=SimpleNamespace(type='private', id=123), answer=answer)
        with patch.object(entry, 'runtime_app_url', return_value='https://example.test'), patch.object(entry, '_remember_menu', return_value=800) as remember, patch.object(entry, '_cleanup_chat_controls', side_effect=cleanup):
            await entry._refresh_chat(message, AsyncMock(), 'https://example.test')
        self.assertEqual(len(replies), 2)
        self.assertEqual(replies[1][1]['reply_markup'].inline_keyboard[0][0].web_app.url, 'https://example.test/')
        remember.assert_any_call(123, 900)

    async def test_profile_command_gets_profile_link(self):
        answer = AsyncMock(return_value=SimpleNamespace(message_id=901))
        message = SimpleNamespace(chat=SimpleNamespace(type='private', id=124), answer=answer)
        with patch.object(entry, 'runtime_app_url', side_effect=lambda url: url), patch.object(entry, '_remember_menu'), patch.object(entry, '_cleanup_chat_controls', new_callable=AsyncMock):
            await entry._refresh_chat(message, AsyncMock(), 'https://example.test', profile=True)
        self.assertTrue(answer.call_args.kwargs['reply_markup'].inline_keyboard[0][0].web_app.url.endswith('/?screen=profile'))
