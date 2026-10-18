"""Verify Telegram Mini App initData before accepting profile or progress writes."""

from __future__ import annotations

import hashlib
import hmac
import json
import os
import time
from urllib.parse import parse_qsl

from fastapi import Header, HTTPException, status

INIT_DATA_TTL_SECONDS = 86_400


def verify_init_data(init_data: str) -> dict | None:
    bot_token = os.getenv("TG_BOT_TOKEN", "")
    if not init_data or not bot_token:
        return None

    pairs = parse_qsl(init_data, keep_blank_values=True)
    data = dict(pairs)
    received_hash = data.pop("hash", None)
    auth_date = data.get("auth_date", "")
    if not received_hash or not auth_date.isdigit():
        return None

    issued_at = int(auth_date)
    now = int(time.time())
    if issued_at > now + 30 or now - issued_at > INIT_DATA_TTL_SECONDS:
        return None

    data_check_string = "\n".join(f"{key}={value}" for key, value in sorted(data.items()))
    secret_key = hmac.new(b"WebAppData", bot_token.encode(), hashlib.sha256).digest()
    expected_hash = hmac.new(secret_key, data_check_string.encode(), hashlib.sha256).hexdigest()
    if not hmac.compare_digest(expected_hash, received_hash):
        return None

    user_json = data.get("user")
    if not user_json:
        return None
    try:
        user = json.loads(user_json)
    except (json.JSONDecodeError, TypeError):
        return None
    if not isinstance(user, dict) or not isinstance(user.get("id"), int):
        return None
    return user


async def get_current_user(x_init_data: str | None = Header(default=None, alias="X-Init-Data")) -> dict:
    if not x_init_data:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Telegram initData required")
    user = verify_init_data(x_init_data)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired Telegram initData")
    return user
