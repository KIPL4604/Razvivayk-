# Развёртывание Развивайки

1. Установи Docker Engine и Docker Compose plugin на сервере. Нужен публичный HTTPS-домен или HTTPS-туннель, который проксирует на порт `8080` этого проекта.
2. Скопируй `.env.example` в `.env`; задай токен бота и итоговый HTTPS-адрес в `APP_URL`.
3. Запусти `docker compose up -d --build`.
4. В @BotFather проверь Menu Button. Бот также устанавливает кнопку «Играть» при старте.
5. Открой Mini App в Telegram и пройди уровень. Профиль должен загрузиться по Telegram `initData`, а завершённая игра — сохранить XP и следующий открытый этап в SQLite-том `game_data`.
6. Проверяй готовность через `/healthz` и состояние контейнеров через `docker compose ps`.

API-контейнер хранит SQLite в именованном Docker-томе. Перед переносом сервера сделай резервную копию тома `game_data`; не удаляй его командой `docker compose down -v`, если нужно сохранить профили.

Для синхронизации файлов предусмотрены `deploy/ssh_helper.py` и `deploy/push_files.py`. Параметры SSH задаются в `deploy/.env` или переменными `RAZVIVAYKA_SSH_HOST`, `RAZVIVAYKA_SSH_USER`, `RAZVIVAYKA_SSH_PASSWORD` либо `RAZVIVAYKA_SSH_KEY_PATH`. Перед первым запуском helper проверь адрес и учётные данные сервера.

Telegram может запросить fullscreen и отключение вертикальных свайпов. Решение о сворачивании свайпом по заголовку остаётся за самим Telegram.

SSH helper requires python -m pip install paramiko in the local deployment environment; it is not a runtime dependency of the bot or Mini App.
