"""The public game contract shared by the library, saves and future modules.

Capabilities describe working routes. Adding a title here does not turn a
single-player game into an online game or grant its client permission to award XP.
"""
from __future__ import annotations

CAMPAIGN_TITLES = {
    "sudoku": "Судоку", "memory": "Найди пары", "riddles": "Логические задачи",
    "sequences": "Числовые ряды", "tiles": "Пятнашки", "pattern": "Матрица памяти",
    "nonogram": "Японский кроссворд", "arithmetic": "Устный счёт",
    "rebuses": "Шифры и ребусы", "stroop": "Цвет и внимание",
}
SAVE_GAMES = frozenset((*CAMPAIGN_TITLES, "chess"))
GAME_IDS = SAVE_GAMES | {"poker", "lumen", "specimen"}


def catalog() -> dict:
    games = [{
        "id": game, "title": title, "modes": ["campaign", "solo"],
        "campaignLevels": 100, "cloudSave": True, "resultAuthority": "server",
        "lifecycle": {"start": "/api/games/start", "save": f"/api/platform/saves/{game}",
                      "finish": "/api/games/complete"},
    } for game, title in CAMPAIGN_TITLES.items()]
    games.append({
        "id": "chess", "title": "Шахматы", "modes": ["solo"],
        "campaignLevels": 0, "cloudSave": True, "resultAuthority": "local",
        "lifecycle": {"start": "client:ChessMode.enter", "save": "/api/platform/saves/chess",
                      "finish": "local:chess.js.isGameOver"},
    })
    games.append({
        "id": "poker", "title": "Математический покер", "modes": ["solo", "multiplayer"],
        "campaignLevels": 0, "cloudSave": False, "resultAuthority": "server",
        "lifecycle": {"start": "/api/poker/solo", "multiplayer": "/api/platform/matchmaking",
                      "save": "server:poker_rooms", "finish": "/api/poker/rooms/{roomId}/action"},
    })
    games.append({
        "id": "specimen", "title": "Нулевой образец", "modes": ["solo"],
        "campaignLevels": 0, "cloudSave": False, "resultAuthority": "local",
        "lifecycle": {"start": "client:SpecimenMode.enter", "save": "local:device",
                      "finish": "local:specimen"},
    })
    games.append({
        "id": "lumen", "title": "Люмен: последний маяк", "modes": ["solo"],
        "campaignLevels": 0, "cloudSave": False, "resultAuthority": "local",
        "lifecycle": {"start": "client:LumenMode.enter", "save": "local:device",
                      "finish": "local:lumen"},
    })
    return {"version": 1, "games": games}
