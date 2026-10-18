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

## Платформа: постоянное размещение

Для постоянного HTTPS-размещения подготовлен отдельный
`deploy/compose.production.yml`: PostgreSQL 17, Redis 7.4, два процесса API,
бот, Caddy, ежедневная резервная копия и Prometheus. Старый `docker-compose.yml`
остаётся простым SQLite-запуском. PostgreSQL/Redis не публикуют порты наружу.
Это готовая конфигурация; публичный VPS и сертификат без сервера/домена не возникают.

1. На своём VPS клонируй `https://github.com/KIPL4604/Razvivayk-.git` и установи
   Docker с Compose. Домен должен указывать на VPS; входящие 80/443 доступны.
2. В корне проекта создай `.env` из `.env.example`. Задай `TG_BOT_TOKEN`, `DOMAIN`,
   `POSTGRES_PASSWORD`, `APP_URL=https://твой-домен` и
   `DATABASE_URL=postgresql://teramont:URL_ENCODED_PASSWORD@db:5432/teramont`.
   Пароль в URL должен быть URL-encoded; значение `POSTGRES_PASSWORD` — исходным.
   Доступ к файлу ограничь владельцем. Секреты не передаются в GitHub.
3. Подними БД и Redis:
   `docker compose --env-file .env -f deploy/compose.production.yml up -d db redis`.
4. Если есть прежняя SQLite, выполни перенос по инструкции ниже до запуска API.
5. Запусти
   `docker compose --env-file .env -f deploy/compose.production.yml up -d --build --wait`.
   Проверь `https://твой-домен/readyz`, реальные два Telegram-клиента и меню бота.
   При переносе с Windows сначала останови старый экземпляр polling-бота, чтобы
   два экземпляра не читали обновления одного Telegram-токена одновременно.

Caddy проксирует WebSocket и получает сертификат для указанного домена.
`/metrics`, `/docs`, `/redoc`, `/openapi.json` закрыты на публичном прокси.
Prometheus доступен только на `127.0.0.1:9090` VPS, например через SSH port forward.
`/healthz` означает живой процесс, `/readyz` дополнительно проверяет БД и транспорт
событий. Redis Pub/Sub не является журналом ходов: истина хранится в БД, а после
переподключения клиент получает актуальный приватный снимок.

Пул PostgreSQL — до 12 соединений на процесс, 24 на два API worker. Настройка
`DATABASE_POOL_SIZE=0` отключает пул для отдельных утилит; в production Compose
задано 12. Учитывай общее число worker при изменении лимита соединений PostgreSQL.

## Перенос SQLite без потери исходной базы

Сначала останови запись в старое приложение. Мигратор по умолчанию только читает
источник и показывает план; `--apply` создаёт SQLite snapshot через backup API,
копирует связанные таблицы одной транзакцией и сверяет количество строк.
Непустые целевые таблицы он не перезаписывает. Сохрани исходную базу до приёмки.

Локальная репетиция, без PostgreSQL:

```powershell
python deploy/migrate_sqlite.py --source runtime/teramont-games.sqlite3 --target-sqlite runtime/migration-rehearsal.sqlite3
python deploy/migrate_sqlite.py --source runtime/teramont-games.sqlite3 --target-sqlite runtime/migration-rehearsal.sqlite3 --apply
```

Для PostgreSQL задай `DATABASE_URL`, указывающий на **пустую целевую БД**, и убери
`--target-sqlite`. Если PostgreSQL работает только внутри Docker-сети, перенеси
источник в игнорируемую папку сервера и запусти мигратор внутри API image с
отдельным read-only bind mount источника. Опция `--poker-source` переносит прежний
отдельный файл `POKER_DB_PATH`, включая очередь `platform_matchmaking`.
После переноса lifespan API идемпотентно добавит новые колонки и индексы.

Ранее завершённые партии и XP сохраняются. Старые незавершённые головоломки без
серверного challenge нужно начать заново; интерфейс сообщает об этом. Нельзя
просто принять старое клиентское `completed` как доказательство решения.

## Копии и восстановление

Сервис `backup` делает custom-format `pg_dump` при старте и раз в сутки,
проверяет каталог `pg_restore --list`, хранит 14 дней в `runtime/backups` и
записывает `last-success`. Папка должна копироваться на другой диск/сервер:
локальная копия не переживёт потерю всего VPS. Внешнее хранилище и канал
уведомлений Prometheus/Alertmanager нужно настроить для выбранного окружения.

Работу восстановления можно проверить без перезаписи рабочей БД:

```powershell
python deploy/verify_backup.py --container teramont-db-1 --database teramont --user teramont
```

Утилита создаёт dump, восстанавливает его в новую случайно названную БД, сверяет
число строк всех public-таблиц и удаляет только созданную ею тестовую БД. Для
точного сравнения останови запись на время репетиции. Настоящее восстановление
после аварии выполняй сначала в новую БД и переключай приложение после проверки.

## GitHub и обновления

`Platform checks` запускает Python/Node проверки, реальные PostgreSQL/Redis
integration tests и Docker build на push/PR. Workflow `Deploy configured server`
запускается вручную после успешных проверок того же revision. Для GitHub
environment `production` нужны secrets `DEPLOY_HOST`, `DEPLOY_USER`,
`DEPLOY_SSH_KEY`, `DEPLOY_KNOWN_HOSTS` и variable `DEPLOY_DIRECTORY` — абсолютный
путь без пробелов. На сервере уже должны быть checkout проекта, `.env` и Docker.
Ключ узла проверяется строго, неизвестный fingerprint не принимается автоматически.

`deploy/release.sh` отказывается работать при изменённых tracked/untracked файлах,
проверяет принадлежность revision истории `origin/main`, сохраняет dump перед
релизом, собирает контейнеры и проверяет readiness. Он не удаляет тома и не делает
force/reset. Откат к предыдущему проверенному SHA выполняется тем же сценарием;
перед изменениями схемы вне текущих добавочных миграций нужен отдельный план отката.

## Изолированные проверки на компьютере

```powershell
docker compose -f deploy/compose.test.yml up -d --wait
python tests/serve_qa.py
```

QA слушает только `127.0.0.1:8081`, имеет отдельную SQLite и публичный тестовый
ключ. Не открывай этот fixture в Интернет. Playwright-сценарии находятся в
`tests/platform-ui.js` и `tests/poker-ui.js`. PostgreSQL/Redis используют отдельные
loopback-порты 25432/26379. Тестовые базы хранятся в tmpfs.

Дополнительные переменные для `unittest`: `TERAMONT_TEST_POSTGRES_URL`,
`PLATFORM_TEST_DATABASE_URL`, `PLATFORM_TEST_REDIS_URL` — только отдельные тестовые
сервисы. Нагрузочная утилита `tests/platform_load.py` принимает лишь loopback и
до 1000 клиентов; требует `PLATFORM_LOAD_BOT_TOKEN` тестового API. Её сценарий —
соединения, чтение лобби и ping/pong; это не измерение предела активных раздач.
