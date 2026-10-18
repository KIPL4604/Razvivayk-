"""Telegram entry point and migration of persistent chat controls."""
from __future__ import annotations

import asyncio
import logging
import json
import os
import sqlite3
import time
from collections import defaultdict
from pathlib import Path
from urllib.parse import urlparse

from aiogram import Bot, Dispatcher, Router, F
from aiogram.exceptions import TelegramBadRequest, TelegramForbiddenError, TelegramRetryAfter
from aiogram.filters import Command
from aiogram.types import (
    BotCommand, BotCommandScopeAllPrivateChats, BotCommandScopeAllGroupChats,
    BotCommandScopeAllChatAdministrators, BotCommandScopeChat,
    BotCommandScopeDefault, CallbackQuery, InlineKeyboardButton,
    InlineKeyboardMarkup, MenuButtonWebApp, Message, ReplyKeyboardRemove, WebAppInfo,
)
from config_env import ROOT, load_env

load_env()
logging.basicConfig(level=os.getenv('LOG_LEVEL', 'INFO'))
router = Router(name='teramont_games')
chat_locks = defaultdict(asyncio.Lock)
last_refresh = {}
COMMANDS = [BotCommand(command='start', description='Открыть игры'),
            BotCommand(command='play', description='Выбрать кампанию'),
            BotCommand(command='profile', description='Профиль, опыт и достижения'),
            BotCommand(command='help', description='Как играть')]


def runtime_app_url(fallback: str) -> str:
    path = Path(os.getenv('PUBLIC_URL_FILE', str(ROOT / 'runtime' / 'public-url.json')))
    try:
        value = json.loads(path.read_text(encoding='utf-8'))['url']
        return value if urlparse(value).scheme == 'https' else fallback
    except (OSError, ValueError, KeyError, TypeError):
        return fallback


def game_keyboard(app_url: str, profile: bool = False) -> InlineKeyboardMarkup:
    url = app_url.rstrip('/') + ('/?screen=profile' if profile else '/')
    return InlineKeyboardMarkup(inline_keyboard=[[
        InlineKeyboardButton(text='Открыть профиль' if profile else 'Играть', web_app=WebAppInfo(url=url))
    ]])


def _remember_menu(chat_id: int, message_id: int | None = None) -> int | None:
    path = Path(os.getenv('BOT_UI_DB_PATH', str(ROOT / 'runtime' / 'bot-ui.sqlite3')))
    path.parent.mkdir(parents=True, exist_ok=True)
    with sqlite3.connect(path) as db:
        db.execute('CREATE TABLE IF NOT EXISTS chat_ui (chat_id INTEGER PRIMARY KEY, menu_message_id INTEGER)')
        previous = db.execute('SELECT menu_message_id FROM chat_ui WHERE chat_id=?', (chat_id,)).fetchone()
        if message_id is not None:
            db.execute('INSERT INTO chat_ui VALUES (?,?) ON CONFLICT(chat_id) DO UPDATE SET menu_message_id=excluded.menu_message_id', (chat_id, message_id))
    return previous[0] if previous else None


async def _remove_inline(bot: Bot, chat_id: int, message_id: int | None) -> None:
    if message_id is None:
        return
    try:
        await bot.edit_message_reply_markup(chat_id=chat_id, message_id=message_id, reply_markup=None)
    except TelegramBadRequest:
        logging.debug('Message controls already removed or message unavailable')


async def configure_bot(bot: Bot, app_url: str | None = None) -> None:
    if app_url:
        await bot.set_chat_menu_button(menu_button=MenuButtonWebApp(text='Играть', web_app=WebAppInfo(url=app_url)))
    # Explicit locale and scope overrides survive source-code changes in Telegram.
    for scope in (BotCommandScopeDefault(), BotCommandScopeAllPrivateChats(), BotCommandScopeAllGroupChats(), BotCommandScopeAllChatAdministrators()):
        for language in ('', 'ru', 'en'):
            existing = await bot.get_my_commands(scope=scope, language_code=language)
            if isinstance(scope, BotCommandScopeDefault) and not language:
                if existing != COMMANDS:
                    await bot.set_my_commands(COMMANDS, scope=scope)
            elif existing:
                await bot.delete_my_commands(scope=scope, language_code=language)
    metadata = (
        ('name', bot.get_my_name, bot.set_my_name, 'Развивайка · Teramont'),
        ('short_description', bot.get_my_short_description, bot.set_my_short_description, 'Игры для ума в Telegram: судоку, память, логика. 10 кампаний, 1000 уровней, XP и достижения.'),
        ('description', bot.get_my_description, bot.set_my_description, 'Играй прямо в Telegram. Судоку, пары, матрица памяти, пятнашки, японские кроссворды, логика, числа, шифры и внимание. В каждой кампании 100 уровней. Получай опыт, открывай достижения и поддерживай серию дней.'),
    )
    for language in ('', 'ru', 'en'):
        for field, getter, setter, value in metadata:
            try:
                current = await getter(language_code=language)
                if getattr(current, field) != value:
                    await setter(**{field: value}, language_code=language)
            except TelegramRetryAfter as error:
                logging.warning('Metadata %s update deferred by Telegram for %s seconds; bot continues', field, error.retry_after)


async def refresh_chat(message: Message, bot: Bot, app_url: str, profile: bool = False) -> None:
    async with chat_locks[message.chat.id]:
        if time.monotonic() - last_refresh.get(message.chat.id, 0) < 2:
            return
        last_refresh[message.chat.id] = time.monotonic()
        await _refresh_chat(message, bot, app_url, profile)


async def _refresh_chat(message: Message, bot: Bot, app_url: str, profile: bool = False) -> None:
    if message.chat.type != 'private':
        return
    app_url = runtime_app_url(app_url)
    scope = BotCommandScopeChat(chat_id=message.chat.id)
    languages = {'', 'ru', 'en', (message.from_user.language_code or '') if message.from_user else ''}
    for language in languages:
        await bot.delete_my_commands(scope=scope, language_code=language)
    await bot.set_chat_menu_button(chat_id=message.chat.id, menu_button=MenuButtonWebApp(text='Играть', web_app=WebAppInfo(url=app_url)))
    await _remove_inline(bot, message.chat.id, _remember_menu(message.chat.id))
    if message.reply_to_message and message.reply_to_message.from_user and message.reply_to_message.from_user.id == bot.id:
        await _remove_inline(bot, message.chat.id, message.reply_to_message.message_id)
    await message.answer('Развивайка · Teramont\n\n10 игровых кампаний по 100 уровней: логика, память и внимание. Опыт, звания, достижения и серия дней сохраняются в твоём профиле.', reply_markup=ReplyKeyboardRemove())
    reply = await message.answer('Выбирай игру и проходи первый уровень.' if not profile else 'Твой опыт, звание и достижения — в профиле.', reply_markup=game_keyboard(app_url, profile))
    _remember_menu(message.chat.id, reply.message_id)


@router.message(Command('start', 'play', 'help', 'profile'))
async def game_commands(message: Message, bot: Bot, app_url: str) -> None:
    await refresh_chat(message, bot, app_url, (message.text or '').split('@')[0].split()[0] == '/profile')


@router.callback_query()
async def old_callback(callback: CallbackQuery, bot: Bot, app_url: str) -> None:
    await callback.answer('Бот обновлён. Открывай игровые кампании.')
    if isinstance(callback.message, Message):
        await _remove_inline(bot, callback.message.chat.id, callback.message.message_id)
        await refresh_chat(callback.message, bot, app_url)


@router.message(F.chat.type == 'private')
async def any_private_message(message: Message, bot: Bot, app_url: str) -> None:
    # Also consumes taps on persistent controls left by previous versions.
    await refresh_chat(message, bot, app_url)


async def refresh_stored_controls(bot: Bot, url: str) -> None:
    path = Path(os.getenv('BOT_UI_DB_PATH', str(ROOT / 'runtime' / 'bot-ui.sqlite3')))
    if not path.exists():
        return
    with sqlite3.connect(path) as db:
        chats = db.execute('SELECT chat_id,menu_message_id FROM chat_ui').fetchall()
    for chat_id, message_id in chats:
        async with chat_locks[chat_id]:
            try:
                for language in ('', 'ru', 'en'):
                    await bot.delete_my_commands(scope=BotCommandScopeChat(chat_id=chat_id), language_code=language)
                await bot.set_chat_menu_button(chat_id=chat_id, menu_button=MenuButtonWebApp(text='Играть', web_app=WebAppInfo(url=url)))
                if message_id:
                    await bot.edit_message_reply_markup(chat_id=chat_id, message_id=message_id, reply_markup=game_keyboard(url))
            except (TelegramBadRequest, TelegramForbiddenError):
                logging.info('A previous chat control is no longer editable')


async def watch_public_url(bot: Bot, dispatcher: Dispatcher, initial_url: str) -> None:
    current = initial_url
    while True:
        await asyncio.sleep(4)
        url = runtime_app_url(current)
        if url == current:
            continue
        try:
            await bot.set_chat_menu_button(menu_button=MenuButtonWebApp(text='Играть', web_app=WebAppInfo(url=url)))
            await refresh_stored_controls(bot, url)
            current = url
            dispatcher.workflow_data['app_url'] = url
            logging.info('Mini App address refreshed: %s', urlparse(url).netloc)
        except Exception as error:
            logging.warning('Could not refresh game link: %s', type(error).__name__)


async def main() -> None:
    token = os.getenv('TG_BOT_TOKEN', '').strip()
    app_url = runtime_app_url(os.getenv('APP_URL', '').strip())
    parsed = urlparse(app_url)
    if not token:
        raise RuntimeError('Set TG_BOT_TOKEN in .env')
    if parsed.scheme != 'https' or not parsed.netloc:
        raise RuntimeError('APP_URL must be a reachable public HTTPS address')
    async with Bot(token=token) as bot:
        await configure_bot(bot, app_url)
        await refresh_stored_controls(bot, app_url)
        dispatcher = Dispatcher()
        dispatcher.include_router(router)
        dispatcher.workflow_data['app_url'] = app_url
        await bot.delete_webhook(drop_pending_updates=False)
        logging.info('Game bot ready; Mini App: %s', parsed.netloc)
        watcher = asyncio.create_task(watch_public_url(bot, dispatcher, app_url))
        try:
            await dispatcher.start_polling(bot, allowed_updates=dispatcher.resolve_used_update_types())
        finally:
            watcher.cancel()
            await asyncio.gather(watcher, return_exceptions=True)


if __name__ == '__main__':
    try:
        asyncio.run(main())
    except (KeyboardInterrupt, SystemExit):
        raise SystemExit(0)
