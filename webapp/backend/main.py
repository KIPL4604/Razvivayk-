"""Telegram game Mini App: static client and authenticated progress API."""

from contextlib import asynccontextmanager
from pathlib import Path
from typing import Literal
import os

from fastapi import Depends, FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field
from fastapi.responses import FileResponse
from .static_compression import StaticAwareGZipMiddleware

from .poker import router as poker_router, init_poker_db
from .auth import get_current_user
from .game_store import GameRuleError, complete_session, get_profile, init_database, start_session
from . import realtime, platform, observability
from .database import connection, close_pools

FRONTEND_DIR = Path(__file__).parent.parent / "frontend"


@asynccontextmanager
async def lifespan(_app: FastAPI):
    # Serialize schema checks between PostgreSQL workers; local SQLite remains a
    # single process development option. Each initializer commits its own work.
    if os.getenv("DATABASE_URL"):
        with connection(write=True) as db:
            db.lock("teramont:schema")
            init_database()
            init_poker_db()
            platform.init_platform_db()
    else:
        init_database()
        init_poker_db()
        platform.init_platform_db()
    await realtime.start()
    try:
        yield
    finally:
        await realtime.stop()
        close_pools()


app = FastAPI(title="Teramont Game Platform", version="4.0.0", lifespan=lifespan)
app.include_router(poker_router)
app.include_router(platform.router)
app.include_router(realtime.router)
app.add_middleware(StaticAwareGZipMiddleware, minimum_size=1000, compresslevel=6)
app.middleware("http")(observability.measure)


@app.middleware("http")
async def fresh_client(request, call_next):
    response = await call_next(request)
    # Public, pinned libraries contain no account data; preserve private API responses.
    response.headers["Cache-Control"] = "public, max-age=604800" if request.url.path.startswith("/static/vendor/") else "no-store"
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["Referrer-Policy"] = "no-referrer"
    return response


class StartGameRequest(BaseModel):
    level_number: int | None = Field(default=None, ge=1, le=100)
    game_type: Literal["sudoku", "memory", "riddles", "sequences", "tiles", "pattern", "nonogram", "arithmetic", "rebuses", "stroop"]
    difficulty: Literal["easy", "medium", "hard"] = "easy"


class CompleteGameRequest(BaseModel):
    session_id: str = Field(min_length=36, max_length=36)
    elapsed_seconds: int = Field(ge=0, le=36_000)
    hints: int = Field(ge=0, le=500)
    moves: int = Field(ge=0, le=10_000)
    proof: dict = Field(default_factory=dict)


@app.get("/healthz")
def health() -> dict:
    return {"ok": True, "service": "teramont", "version": "4.0.0", "games": 10, "freePlayGames": ["chess", "poker", "lumen", "specimen", "durak", "blackjack", "solitaire"], "campaignLevels": 1000, "telegramAuthConfigured": bool(os.getenv("TG_BOT_TOKEN"))}


@app.get("/readyz")
def ready() -> dict:
    try:
        with connection() as db:
            db.execute("SELECT 1").fetchone()
        events = realtime.status()
        if not events["connected"]:
            raise RuntimeError("event transport unavailable")
        return {"ok": True, "database": "postgres" if os.getenv("DATABASE_URL") else "sqlite", "events": events["transport"]}
    except Exception as error:
        raise HTTPException(503, "Сервис временно не готов") from error


app.get("/metrics", include_in_schema=False)(observability.metrics)


@app.get("/api/profile")
def profile(user: dict = Depends(get_current_user)) -> dict:
    return get_profile(user)


@app.post("/api/games/start")
def game_start(payload: StartGameRequest, user: dict = Depends(get_current_user)) -> dict:
    try:
        return start_session(user, payload.level_number, payload.game_type, payload.difficulty)
    except GameRuleError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error


@app.post("/api/games/complete")
def game_complete(payload: CompleteGameRequest, user: dict = Depends(get_current_user)) -> dict:
    try:
        return complete_session(user, payload.session_id, payload.elapsed_seconds, payload.hints, payload.moves, payload.proof)
    except GameRuleError as error:
        raise HTTPException(status_code=409, detail=str(error)) from error


app.mount("/static", StaticFiles(directory=str(FRONTEND_DIR)), name="static")


@app.get("/")
def root() -> FileResponse:
    return FileResponse(FRONTEND_DIR / "index.html")
