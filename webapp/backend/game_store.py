"""Persistent profiles and ten independent 100-level campaigns."""
from __future__ import annotations
from contextlib import contextmanager
from datetime import date, datetime, timedelta, timezone
import os
from pathlib import Path
import sqlite3
import time
import uuid
from typing import Iterator
from config_env import load_env
load_env()
GAME_NAMES = {"sudoku":"Судоку","memory":"Найди пары","riddles":"Логические задачи","sequences":"Числовые ряды","tiles":"Пятнашки","pattern":"Матрица памяти","nonogram":"Японский кроссворд","arithmetic":"Устный счёт","rebuses":"Шифры и ребусы","stroop":"Цвет и внимание"}
BASE_XP = dict(zip(GAME_NAMES,(30,26,24,24,30,26,30,24,24,26)))
MAX_LEVEL = 100
XP_PER_LEVEL = 100
DAY_ZONE = timezone(timedelta(hours=3))
DIFFICULTY_LABELS = {"easy":"Легко","medium":"Средне","hard":"Сложно"}
RANKS = ((1,"Новичок"),(3,"Практик"),(6,"Мыслитель"),(11,"Тактик"),(21,"Мастер"),(41,"Легенда"),(81,"Виртуоз"),(151,"Стратег"),(301,"Архитектор мысли"))
ACHIEVEMENTS = [dict(zip(("id","title","description","icon"),a)) for a in (
("first_game","Первый ход","Заверши первую партию","✦"),
("ten_games","Вошёл в ритм","Заверши 10 партий","↗"),
("hundred_games","Большая сотня","Заверши 100 партий","◎"),
("no_hints_five","Сам справился","Пять партий без подсказок","◇"),
("streak_three","Три дня в игре","Играй три дня подряд","⌁"),
("streak_seven","Полная неделя","Играй семь дней подряд","⌁"),
("streak_thirty","Привычка играть","Играй 30 дней подряд","⌁"),
("all_games","Любопытство","Заверши партию в каждой из десяти игр","✧"),
("chapter_two","Вторая глава","Пройди 10 уровней одной кампании","✧"),
("campaign_100","Полная дистанция","Пройди целиком одну кампанию","✺"))]
ACHIEVEMENTS += [{"id":g+"_five","title":"Практик: "+n,"description":"Заверши пять партий в этой игре","icon":"◇"} for g,n in GAME_NAMES.items()]
ACHIEVEMENTS += [{"id":g+"_100","title":"Мастер: "+n,"description":"Все 100 уровней кампании пройдены","icon":"✺"} for g,n in GAME_NAMES.items()]
class GameRuleError(ValueError):
    """Invalid game session operation."""

def level_config(level_number: int, game_type: str = "sudoku") -> dict:
    if not 1 <= level_number <= MAX_LEVEL or game_type not in GAME_NAMES:
        raise GameRuleError("Неизвестная кампания или уровень")
    difficulty = "easy" if level_number <= 20 else "medium" if level_number <= 60 else "hard"
    return {"number":level_number,"game":game_type,"gameName":GAME_NAMES[game_type],"difficulty":difficulty,"difficultyName":DIFFICULTY_LABELS[difficulty],"chapter":(level_number-1)//10+1}

def _db_path() -> Path:
    return Path(os.getenv("GAME_DB_PATH", "runtime/teramont.sqlite3")).resolve()


@contextmanager
def _connection() -> Iterator[sqlite3.Connection]:
    path = _db_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(path, timeout=15)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys = ON")
    connection.execute("PRAGMA busy_timeout = 15000")
    try:
        yield connection
        connection.commit()
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.close()


def init_database() -> None:
    with _connection() as connection:
        connection.execute("PRAGMA journal_mode = WAL")
        connection.executescript(
            """
            CREATE TABLE IF NOT EXISTS game_profiles (
                user_id INTEGER PRIMARY KEY,
                first_name TEXT NOT NULL DEFAULT 'Игрок',
                username TEXT,
                xp INTEGER NOT NULL DEFAULT 0,
                unlocked_level INTEGER NOT NULL DEFAULT 1,
                current_streak INTEGER NOT NULL DEFAULT 0,
                best_streak INTEGER NOT NULL DEFAULT 0,
                last_played_date TEXT,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS game_sessions (
                session_id TEXT PRIMARY KEY,
                user_id INTEGER NOT NULL REFERENCES game_profiles(user_id),
                game_type TEXT NOT NULL,
                difficulty TEXT NOT NULL,
                level_number INTEGER,
                started_at INTEGER NOT NULL,
                completed_at INTEGER,
                elapsed_seconds INTEGER,
                hints INTEGER,
                moves INTEGER,
                xp_awarded INTEGER
            );
            CREATE INDEX IF NOT EXISTS ix_game_sessions_user_done
                ON game_sessions(user_id, completed_at);
            CREATE INDEX IF NOT EXISTS ix_game_sessions_user_level
                ON game_sessions(user_id, level_number);
            CREATE TABLE IF NOT EXISTS game_achievements (
                user_id INTEGER NOT NULL REFERENCES game_profiles(user_id),
                achievement_id TEXT NOT NULL,
                unlocked_at TEXT NOT NULL,
                PRIMARY KEY(user_id, achievement_id)
            );
            """
        )
        columns = {row[1] for row in connection.execute("PRAGMA table_info(game_sessions)")}
        if "campaign_id" not in columns:
            connection.execute("ALTER TABLE game_sessions ADD COLUMN campaign_id TEXT")
            connection.execute("UPDATE game_sessions SET campaign_id=game_type,level_number=CAST((level_number-1)/4 AS INTEGER)+1 WHERE level_number IS NOT NULL")
        connection.execute("CREATE INDEX IF NOT EXISTS ix_campaign_progress ON game_sessions(user_id,campaign_id,level_number,completed_at)")



def _ensure_profile(connection: sqlite3.Connection, user: dict) -> sqlite3.Row:
    user_id = int(user["id"])
    first_name = str(user.get("first_name") or "Игрок")[:128]
    username = str(user.get("username") or "")[:64] or None
    now = datetime.now(timezone.utc).isoformat()
    connection.execute(
        """INSERT INTO game_profiles(user_id, first_name, username, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?)
           ON CONFLICT(user_id) DO UPDATE SET
             first_name=excluded.first_name, username=excluded.username, updated_at=excluded.updated_at""",
        (user_id, first_name, username, now, now),
    )
    return connection.execute("SELECT * FROM game_profiles WHERE user_id=?", (user_id,)).fetchone()


def _stats(connection: sqlite3.Connection, user_id: int) -> dict:
    rows = connection.execute(
        """SELECT game_type, COUNT(*) AS amount,
                  SUM(CASE WHEN hints=0 THEN 1 ELSE 0 END) AS no_hints
           FROM game_sessions WHERE user_id=? AND completed_at IS NOT NULL GROUP BY game_type""",
        (user_id,),
    ).fetchall()
    counts = {game: 0 for game in GAME_NAMES}
    no_hint_count = 0
    for row in rows:
        counts[row["game_type"]] = int(row["amount"] or 0)
        no_hint_count += int(row["no_hints"] or 0)
    counts["total"] = sum(counts.values())
    counts["noHints"] = no_hint_count
    return counts


def _campaigns(db, user_id):
    completed = {game:set() for game in GAME_NAMES}
    for r in db.execute("SELECT DISTINCT campaign_id,level_number FROM game_sessions WHERE user_id=? AND completed_at IS NOT NULL AND campaign_id IS NOT NULL",(user_id,)):
        if r[0] in completed and 1 <= r[1] <= MAX_LEVEL:
            completed[r[0]].add(r[1])
    return {g:{"game":g,"name":GAME_NAMES[g],"unlockedLevel":next((n for n in range(1,101) if n not in done),100),"completedLevels":sorted(done),"completedCount":len(done),"complete":len(done)==100,"maxLevel":100} for g,done in completed.items()}


def _unlock_eligible_achievements(db,player,stats):
    campaigns = _campaigns(db,player["user_id"])
    eligible = set()
    for count,key in ((1,"first_game"),(10,"ten_games"),(100,"hundred_games")):
        if stats["total"] >= count:
            eligible.add(key)
    if stats["noHints"] >= 5:
        eligible.add("no_hints_five")
    for days,key in ((3,"streak_three"),(7,"streak_seven"),(30,"streak_thirty")):
        if player["best_streak"] >= days:
            eligible.add(key)
    if all(stats[g] for g in GAME_NAMES):
        eligible.add("all_games")
    for game,c in campaigns.items():
        if stats[game] >= 5:
            eligible.add(game+"_five")
        if c["unlockedLevel"] >= 11:
            eligible.add("chapter_two")
        if c["complete"]:
            eligible.update(("campaign_100",game+"_100"))
    unlocked = {r[0] for r in db.execute("SELECT achievement_id FROM game_achievements WHERE user_id=?",(player["user_id"],))}
    newly = sorted(eligible-unlocked)
    now = datetime.now(timezone.utc).isoformat()
    db.executemany("INSERT OR IGNORE INTO game_achievements VALUES (?,?,?)",[(player["user_id"],a,now) for a in newly])
    return newly


def _profile_snapshot(db,user_id):
    p = db.execute("SELECT * FROM game_profiles WHERE user_id=?",(user_id,)).fetchone()
    stats, campaigns = _stats(db,user_id), _campaigns(db,user_id)
    xp, level = p["xp"], p["xp"]//XP_PER_LEVEL+1
    rank_index = max(i for i,(required,_) in enumerate(RANKS) if level>=required)
    next_rank = RANKS[rank_index+1] if rank_index+1<len(RANKS) else (None,None)
    unlocked = {r[0]:r[1] for r in db.execute("SELECT achievement_id,unlocked_at FROM game_achievements WHERE user_id=?",(user_id,))}
    last = date.fromisoformat(p["last_played_date"]) if p["last_played_date"] else None
    streak = p["current_streak"] if last and last>=datetime.now(DAY_ZONE).date()-timedelta(days=1) else 0
    return {"userId":user_id,"displayName":p["first_name"],"username":p["username"],"xp":xp,"level":level,"xpIntoLevel":xp%100,"xpToNext":100,"xpProgress":xp%100,"rank":RANKS[rank_index][1],"nextRank":next_rank[1],"nextRankLevel":next_rank[0],"maxLevel":100,"totalGames":stats["total"],"streak":streak,"bestStreak":p["best_streak"],"stats":stats,"campaigns":campaigns,"campaignLevels":100*len(GAME_NAMES),"completedCampaignLevels":sum(c["completedCount"] for c in campaigns.values()),"achievements":[{**a,"unlocked":a["id"] in unlocked,"unlockedAt":unlocked.get(a["id"])} for a in ACHIEVEMENTS]}


def get_profile(user):
    with _connection() as db:
        p = _ensure_profile(db,user)
        _unlock_eligible_achievements(db,p,_stats(db,int(user["id"])))
        return _profile_snapshot(db,int(user["id"]))


def start_session(user,level_number,game_type,difficulty):
    with _connection() as db:
        _ensure_profile(db,user)
        if game_type not in GAME_NAMES:
            raise GameRuleError("Выбери игровую кампанию")
        if level_number is not None:
            config = level_config(level_number,game_type)
            if level_number>_campaigns(db,int(user["id"]))[game_type]["unlockedLevel"]:
                raise GameRuleError("Сначала пройди предыдущий уровень этой кампании")
            difficulty = config["difficulty"]
        else:
            if difficulty not in DIFFICULTY_LABELS:
                raise GameRuleError("Неизвестная сложность")
            config = {"number":None,"game":game_type,"difficulty":difficulty}
        session_id = str(uuid.uuid4())
        db.execute("INSERT INTO game_sessions(session_id,user_id,game_type,difficulty,level_number,started_at,campaign_id) VALUES (?,?,?,?,?,?,?)",(session_id,int(user["id"]),game_type,difficulty,level_number,int(time.time()),game_type if level_number else None))
        return {"sessionId":session_id,**config}


def complete_session(user,session_id,elapsed_seconds,hints,moves):
    user_id = int(user["id"])
    with _connection() as db:
        p = _ensure_profile(db,user)
        s = db.execute("SELECT * FROM game_sessions WHERE session_id=? AND user_id=?",(session_id,user_id)).fetchone()
        if not s:
            raise GameRuleError("Игровая сессия не найдена")
        if s["completed_at"] is not None:
            return {"xpAwarded":s["xp_awarded"],"newAchievements":[],"profile":_profile_snapshot(db,user_id),"alreadyCompleted":True}
        elapsed = max(0,int(time.time())-s["started_at"])
        if elapsed<2:
            raise GameRuleError("Партия ещё не завершена")
        game,number = s["game_type"],s["level_number"]
        replay = bool(number and number in _campaigns(db,user_id)[game]["completedLevels"])
        xp = (10 if replay else BASE_XP[game]+{"easy":0,"medium":10,"hard":20}[s["difficulty"]]+(10 if number else 0))+(5 if hints==0 else 0)
        today = datetime.now(DAY_ZONE).date()
        last = date.fromisoformat(p["last_played_date"]) if p["last_played_date"] else None
        streak = p["current_streak"] if last==today else p["current_streak"]+1 if last==today-timedelta(days=1) else 1
        now = datetime.now(timezone.utc).isoformat()
        db.execute("UPDATE game_profiles SET xp=xp+?,current_streak=?,best_streak=?,last_played_date=?,updated_at=? WHERE user_id=?",(xp,streak,max(streak,p["best_streak"]),today.isoformat(),now,user_id))
        db.execute("UPDATE game_sessions SET completed_at=?,elapsed_seconds=?,hints=?,moves=?,xp_awarded=? WHERE session_id=?",(int(time.time()),min(max(elapsed_seconds,elapsed),36000),hints,moves,xp,session_id))
        updated = db.execute("SELECT * FROM game_profiles WHERE user_id=?",(user_id,)).fetchone()
        newly = _unlock_eligible_achievements(db,updated,_stats(db,user_id))
        return {"xpAwarded":xp,"newAchievements":[a for a in ACHIEVEMENTS if a["id"] in newly],"profile":_profile_snapshot(db,user_id),"alreadyCompleted":False}
