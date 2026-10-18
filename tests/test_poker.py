"""Rule, privacy, chip-conservation and real HTTP persistence checks for poker."""
import hashlib
import hmac
from concurrent.futures import ThreadPoolExecutor
import json
import os
from pathlib import Path
import random
import tempfile
import time
import unittest
from unittest.mock import patch
from urllib.parse import urlencode

from fastapi import FastAPI, Header
from fastapi.testclient import TestClient

from webapp.backend import poker as p
from webapp.backend.auth import get_current_user


def make_room(stacks=(1000, 1000)):
    room = p._new_room("online", p._player("tg:101", "Первый"))
    room["players"].append(p._player("tg:202", "Второй"))
    for player, stack in zip(room["players"], stacks):
        player["stack"] = stack
    p._start_hand(room)
    return room


def chips(room):
    return sum(player["stack"] + player["committed"] for player in room["players"])


class PokerEvaluationTests(unittest.TestCase):
    def test_all_categories_and_wheel(self):
        cases = (
            ("As Qd 9c 7h 4s 3d 2c", (0, 14, 12, 9, 7, 4)),
            ("As Ad Qc 7h 4s 3d 2c", (1, 14, 12, 7, 4)),
            ("As Ad Qc Qh 4s 3d 2c", (2, 14, 12, 4)),
            ("As Ad Ac Qh 4s 3d 2c", (3, 14, 12, 4)),
            ("As 2d 3c 4h 5s Kd Qc", (4, 5)),
            ("As Qs 9s 7s 4s 3d 2c", (5, 14, 12, 9, 7, 4)),
            ("As Ad Ac Qh Qs Qd 2c", (6, 14, 12)),
            ("As Ad Ac Ah Qs 3d 2c", (7, 14, 12)),
            ("As 2s 3s 4s 5s Kd Qc", (8, 5)),
        )
        for cards, expected in cases:
            with self.subTest(cards=cards):
                self.assertEqual(p.evaluate(cards.split()), expected)
                self.assertEqual(p.evaluate(p.best_five(cards.split())), expected)

    def test_kickers_flush_and_six_high_beat_wheel(self):
        self.assertGreater(p.evaluate("As 2h 3c 4d 5s 6c Kh".split()), p.evaluate("As 2h 3c 4d 5s Qc Kh".split()))
        self.assertGreater(p.evaluate("As Ad Kc Qh 9s 2d 3c".split()), p.evaluate("Ah Ac Kd Qs 8h 2c 3d".split()))
        self.assertEqual(p.evaluate("As Ks Qs Js Ts 2d 3c".split()), (8, 14))
        self.assertGreater(p.evaluate("As Js 9s 8s 7s 6d 5c".split()), p.evaluate("Ks Qs 9s 8s 7s 6d 5c".split()))

    def test_direct_seven_rank_matches_exhaustive_five(self):
        rng = random.Random(182)
        for _ in range(300):
            cards = rng.sample(p.DECK, 7)
            expected = max(p.evaluate(combo) for combo in p.combinations(cards, 5))
            self.assertEqual(p.evaluate(cards), expected)

    def test_equity_ties_and_no_private_opponent_input(self):
        board = "As Ks Qs Js Ts".split()
        self.assertEqual(p.estimate_equity(["2h", "3c"], board, 40, random.Random(1)), 0.5)
        self.assertEqual(p.estimate_equity(["As", "Ks"], "Qs Js Ts".split(), 50, random.Random(2)), 1.0)


class PokerRulesTests(unittest.TestCase):
    def test_preflop_big_blind_option_and_street_order(self):
        room = make_room()
        self.assertEqual([player["bet"] for player in room["players"]], [10, 20])
        self.assertEqual(p.player_view(room, 0)["toCall"], 10)
        p.apply_action(room, 0, "call")
        self.assertEqual(room["street"], "preflop")
        self.assertEqual(room["turnIndex"], 1)
        self.assertIn("raise", p.legal_actions(room, 1))
        p.apply_action(room, 1, "check")
        self.assertEqual(room["street"], "flop")
        self.assertEqual(room["turnIndex"], 1)
        for expected in ("turn", "river", "showdown"):
            p.apply_action(room, 1, "check")
            p.apply_action(room, 0, "check")
            self.assertEqual(room["street"], expected)
        self.assertEqual(len(room["board"]), 5)
        self.assertEqual(len(room["burned"]), 3)
        all_cards = room["deck"] + room["board"] + room["burned"] + sum([player["hole"] for player in room["players"]], [])
        self.assertEqual(len(all_cards), 52)
        self.assertEqual(len(set(all_cards)), 52)
        self.assertEqual(chips(room), 2000)

    def test_minimum_raise_and_reopening(self):
        room = make_room()
        for amount in (21, 30, 39, 1001, True, None):
            with self.subTest(amount=amount), self.assertRaises(p.PokerRuleError):
                p.apply_action(room, 0, "raise", amount)
        p.apply_action(room, 0, "raise", 100)
        self.assertEqual(p.player_view(room, 1)["minRaiseTo"], 180)
        with self.assertRaises(p.PokerRuleError):
            p.apply_action(room, 1, "raise", 179)
        p.apply_action(room, 1, "raise", 180)
        self.assertIn("raise", p.legal_actions(room, 0))
        self.assertEqual(p.player_view(room, 0)["minRaiseTo"], 260)
        self.assertEqual(chips(room), 2000)

    def test_short_all_in_raise_and_no_raise_against_all_in(self):
        room = make_room((1000, 30))
        p.apply_action(room, 0, "call")
        self.assertEqual(p.player_view(room, 1)["minRaiseTo"], 30)
        p.apply_action(room, 1, "raise", 30)
        self.assertNotIn("raise", p.legal_actions(room, 0))
        self.assertEqual(room["lastRaise"], 20)
        p.apply_action(room, 0, "call")
        self.assertEqual(room["result"]["pot"], 60)
        self.assertEqual(len(room["board"]), 5)
        self.assertEqual(chips(room), 1030)

    def test_short_call_refund_and_effective_pot_odds(self):
        room = make_room((1000, 100))
        p.apply_action(room, 0, "raise", 200)
        self.assertEqual(p._pot_numbers(room, 1), (120, 80, 0.4))
        p.apply_action(room, 1, "call")
        self.assertEqual(room["result"]["pot"], 200)
        self.assertTrue(any("возврат неуравненной ставки 100" in line for line in room["log"]))
        self.assertEqual(chips(room), 1100)

    def test_all_in_blinds_run_out_without_impossible_action(self):
        for stacks, pot in (((5, 100), 10), ((100, 10), 20), ((10, 10), 20)):
            with self.subTest(stacks=stacks):
                room = make_room(stacks)
                self.assertIn(room["phase"], ("complete", "finished"))
                self.assertEqual(room["result"]["pot"], pot)
                self.assertEqual(chips(room), sum(stacks))

    def test_fold_private_cards_and_uncalled_refund(self):
        room = make_room()
        opponent = room["players"][1]["hole"][:]
        p.apply_action(room, 0, "fold")
        self.assertEqual([player["stack"] for player in room["players"]], [990, 1010])
        self.assertEqual(room["result"]["pot"], 20)
        view = p.player_view(room, 0)
        self.assertEqual(view["players"][1]["hole"], [None, None])
        self.assertEqual(view["result"]["winners"][0]["hand"], [])
        self.assertFalse(any(json.dumps(card) in json.dumps(view) for card in opponent))
        self.assertNotIn("deck", view)
        self.assertNotIn("tokenHash", view)

    def test_board_royal_flush_split_and_best_five(self):
        room = make_room()
        room["board"] = "As Ks Qs Js Ts".split()
        room["players"][0]["hole"] = ["2h", "3h"]
        room["players"][1]["hole"] = ["4d", "5d"]
        room["players"][0].update(stack=900, committed=100, bet=0)
        room["players"][1].update(stack=900, committed=100, bet=0)
        p._finish(room)
        self.assertEqual([player["stack"] for player in room["players"]], [1000, 1000])
        self.assertEqual(len(room["result"]["winners"]), 2)
        self.assertEqual(p.player_view(room, 0)["players"][1]["hole"], ["4d", "5d"])
        self.assertEqual(set(room["result"]["winners"][0]["hand"]), set(room["board"]))

    def test_next_requires_both_players_and_rotates_button(self):
        room = make_room()
        p.apply_action(room, 0, "fold")
        p.apply_action(room, 0, "next")
        self.assertEqual(room["phase"], "complete")
        self.assertNotIn("next", p.legal_actions(room, 0))
        p.apply_action(room, 1, "next")
        self.assertEqual((room["dealerIndex"], room["turnIndex"], room["handNumber"]), (1, 1, 2))
        self.assertEqual(chips(room), 2000)

    def test_out_of_turn_and_check_facing_bet_rejected(self):
        room = make_room()
        with self.assertRaises(p.PokerRuleError):
            p.apply_action(room, 1, "call")
        with self.assertRaises(p.PokerRuleError):
            p.apply_action(room, 0, "check")
        self.assertEqual(chips(room), 2000)

    def test_random_legal_play_conserves_chips(self):
        rng = random.Random(193)
        for _ in range(80):
            room = make_room((rng.randrange(5, 1500), rng.randrange(5, 1500)))
            bankroll = chips(room)
            for _ in range(100):
                if room["phase"] != "playing":
                    break
                seat = room["turnIndex"]
                actions = [action for action in p.legal_actions(room, seat) if action != "leave"]
                action = rng.choice(actions)
                view = p.player_view(room, seat)
                amount = rng.randint(view["minRaiseTo"], view["maxRaiseTo"]) if action == "raise" else None
                p.apply_action(room, seat, action, amount)
                self.assertEqual(chips(room), bankroll)
                self.assertTrue(all(player["stack"] >= 0 for player in room["players"]))
            self.assertNotEqual(room["phase"], "playing", "A hand must finish")


class PokerHTTPTests(unittest.TestCase):
    def setUp(self):
        self.folder = tempfile.TemporaryDirectory()
        self.env = patch.dict(os.environ, {"POKER_DB_PATH": str(Path(self.folder.name) / "poker.sqlite3"), "TG_BOT_TOKEN": "poker-test-hmac"})
        self.env.start()
        p.init_poker_db()
        self.app = FastAPI()
        self.app.include_router(p.router)
        self.client = TestClient(self.app)

    def tearDown(self):
        self.client.close()
        self.env.stop()
        self.folder.cleanup()

    def headers(self, user_id):
        values = {"auth_date": str(int(time.time())), "user": json.dumps({"id": user_id, "first_name": f"Player {user_id}"})}
        key = hmac.new(b"WebAppData", b"poker-test-hmac", hashlib.sha256).digest()
        check = "\n".join(f"{key}={value}" for key, value in sorted(values.items()))
        values["hash"] = hmac.new(key, check.encode(), hashlib.sha256).hexdigest()
        return {"X-Init-Data": urlencode(values)}

    def online(self):
        first = self.client.post("/api/poker/rooms", headers=self.headers(101))
        self.assertEqual(first.status_code, 200, first.text)
        result = first.json()
        second = self.client.post("/api/poker/rooms/join", json={"code": result["state"]["code"]}, headers=self.headers(202))
        self.assertEqual(second.status_code, 200, second.text)
        return result["roomId"], second.json()["state"]

    def test_two_http_users_auth_override_and_reconnect_privacy(self):
        async def authenticated(x_test_id: int = Header(alias="X-Test-Id")):
            return {"id": x_test_id, "first_name": f"Test {x_test_id}"}
        self.app.dependency_overrides[get_current_user] = authenticated
        created = self.client.post("/api/poker/rooms", headers={"X-Test-Id": "101"}).json()
        joined = self.client.post("/api/poker/rooms/join", json={"code": created["state"]["code"]}, headers={"X-Test-Id": "202"})
        self.assertEqual(joined.status_code, 200)
        self.app.dependency_overrides.clear()
        room_id = created["roomId"]
        first = self.client.get(f"/api/poker/rooms/{room_id}", headers=self.headers(101)).json()
        second = self.client.get(f"/api/poker/rooms/{room_id}", headers=self.headers(202)).json()
        self.assertEqual(first["players"][1]["hole"], [None, None])
        self.assertEqual(second["players"][0]["hole"], [None, None])
        self.assertTrue(all(first["players"][0]["hole"]))
        response = self.client.post(f"/api/poker/rooms/{room_id}/action", json={"action": "call", "version": first["version"]}, headers=self.headers(101))
        self.assertEqual(response.status_code, 200)
        state = response.json()
        self.assertEqual(state["turnIndex"], 1)
        # A newly constructed HTTP client reconnects to the persisted same room.
        with TestClient(self.app) as reconnect:
            restored = reconnect.get(f"/api/poker/rooms/{room_id}", headers=self.headers(202)).json()
            self.assertEqual(restored["version"], state["version"])
            self.assertEqual(restored["turnIndex"], 1)

    def test_online_requires_verified_auth_and_locked_room(self):
        self.assertEqual(self.client.post("/api/poker/rooms").status_code, 401)
        self.assertEqual(self.client.post("/api/poker/rooms", headers={"X-Init-Data": "user=101"}).status_code, 401)
        room_id, state = self.online()
        self.assertEqual(self.client.get(f"/api/poker/rooms/{room_id}", headers=self.headers(303)).status_code, 403)
        self.assertEqual(self.client.post("/api/poker/rooms/join", json={"code": state["code"]}, headers=self.headers(303)).status_code, 409)
        rejoin = self.client.post("/api/poker/rooms/join", json={"code": state["code"]}, headers=self.headers(202))
        self.assertEqual(rejoin.json()["state"]["version"], state["version"])

    def test_version_rejection_and_illegal_action_do_not_mutate(self):
        room_id, state = self.online()
        url = f"/api/poker/rooms/{room_id}/action"
        wrong_turn = self.client.post(url, json={"action": "call", "version": state["version"]}, headers=self.headers(202))
        self.assertEqual(wrong_turn.status_code, 409)
        wrong_amount = self.client.post(url, json={"action": "raise", "amount": 30, "version": state["version"]}, headers=self.headers(101))
        self.assertEqual(wrong_amount.status_code, 409)
        good = self.client.post(url, json={"action": "call", "version": state["version"]}, headers=self.headers(101))
        self.assertEqual(good.status_code, 200)
        self.assertEqual(good.json()["version"], state["version"] + 1)
        stale = self.client.post(url, json={"action": "check", "version": state["version"]}, headers=self.headers(202))
        self.assertEqual(stale.status_code, 409)
        self.assertEqual(self.client.get(f"/api/poker/rooms/{room_id}", headers=self.headers(101)).json()["version"], state["version"] + 1)
        self.assertEqual(self.client.post(url, json={"action": "raise", "amount": True, "version": 2}, headers=self.headers(101)).status_code, 422)

    def test_simultaneous_same_version_actions_commit_once(self):
        room_id, state = self.online()
        def submit(action):
            with TestClient(self.app) as client:
                return client.post(f"/api/poker/rooms/{room_id}/action", json={"action": action, "version": state["version"]}, headers=self.headers(101)).status_code
        with ThreadPoolExecutor(max_workers=2) as workers:
            statuses = list(workers.map(submit, ("call", "fold")))
        self.assertEqual(sorted(statuses), [200, 409])
        current = self.client.get(f"/api/poker/rooms/{room_id}", headers=self.headers(101)).json()
        self.assertEqual(current["version"], state["version"] + 1)
        self.assertEqual(sum(player["stack"] + player["committed"] for player in current["players"]), 2000)

    def test_http_two_players_complete_hand_and_both_ready(self):
        room_id, state = self.online()
        endpoint = f"/api/poker/rooms/{room_id}"
        streets = []
        while state["phase"] == "playing":
            seat = state["turnIndex"]
            headers = self.headers(101 if seat == 0 else 202)
            state = self.client.get(endpoint, headers=headers).json()
            action = "call" if "call" in state["legalActions"] else "check"
            response = self.client.post(endpoint + "/action", json={"action": action, "version": state["version"]}, headers=headers)
            self.assertEqual(response.status_code, 200, response.text)
            state = response.json()
            streets.append(state["street"])
        self.assertEqual(set(streets), {"preflop", "flop", "turn", "river", "showdown"})
        self.assertEqual(state["result"]["pot"], 40)
        self.assertTrue(all(all(player["hole"]) for player in state["players"]))
        first_ready = self.client.post(endpoint + "/action", json={"action": "next", "version": state["version"]}, headers=self.headers(101)).json()
        self.assertEqual(first_ready["ready"], [0])
        self.assertEqual(first_ready["phase"], "complete")
        second_ready = self.client.post(endpoint + "/action", json={"action": "next", "version": first_ready["version"]}, headers=self.headers(202)).json()
        self.assertEqual((second_ready["dealerIndex"], second_ready["turnIndex"], second_ready["handNumber"]), (1, 1, 2))

    def test_guest_solo_secure_token_bot_and_hint(self):
        created = self.client.post("/api/poker/solo", json={"name": "Гость"})
        self.assertEqual(created.status_code, 200, created.text)
        data = created.json()
        url = f"/api/poker/rooms/{data['roomId']}"
        headers = {"X-Poker-Token": data["token"]}
        self.assertEqual(self.client.get(url).status_code, 401)
        self.assertEqual(self.client.get(url, headers={"X-Poker-Token": "x" * 43}).status_code, 403)
        other = self.client.post("/api/poker/solo", json={}).json()
        self.assertEqual(self.client.get(url, headers={"X-Poker-Token": other["token"]}).status_code, 403)
        hint = self.client.get(url + "/hint", headers=headers)
        self.assertEqual(hint.status_code, 200)
        self.assertEqual(hint.json()["potOdds"], 0.25)
        self.assertEqual(hint.json()["samples"], 400)
        self.assertIsNone(hint.json()["handName"])
        self.assertNotIn("deck", hint.json())
        response = self.client.post(url + "/action", json={"action": "call", "version": data["state"]["version"]}, headers=headers)
        self.assertEqual(response.status_code, 200, response.text)
        state = response.json()
        self.assertTrue(state["phase"] != "playing" or state["turnIndex"] == 0)
        self.assertEqual(sum(player["stack"] + player["committed"] for player in state["players"]), 2000)
        self.assertEqual(self.client.get(url, headers=headers).json(), state)

    def test_bot_equity_receives_only_own_and_public_cards(self):
        room = make_room()
        room["players"][1]["isBot"] = True
        p.apply_action(room, 0, "call")
        with patch.object(p, "estimate_equity", return_value=0.1) as estimate:
            p._bot_turn(room)
            for call in estimate.call_args_list:
                self.assertEqual(call.args[0], room["players"][1]["hole"])
                self.assertIsInstance(call.args[1], list)
                self.assertEqual(len(call.args), 3)

    def test_signed_solo_reconnect_by_telegram_and_expired_room(self):
        data = self.client.post("/api/poker/solo", json={}, headers=self.headers(101)).json()
        url = f"/api/poker/rooms/{data['roomId']}"
        self.assertEqual(self.client.get(url, headers=self.headers(101)).status_code, 200)
        self.assertEqual(self.client.get(url, headers=self.headers(202)).status_code, 403)
        with p._connection(True) as db:
            db.execute("UPDATE poker_rooms SET expires_at=0 WHERE room_id=?", (data["roomId"],))
        self.assertEqual(self.client.get(url, headers=self.headers(101)).status_code, 404)
        p.init_poker_db()
        with p._connection() as db:
            self.assertEqual(db.execute("SELECT COUNT(*) FROM poker_rooms").fetchone()[0], 0)

    def test_leave_closes_room_and_no_future_actions(self):
        room_id, state = self.online()
        url = f"/api/poker/rooms/{room_id}/action"
        closed = self.client.post(url, json={"action": "leave", "version": state["version"]}, headers=self.headers(202))
        self.assertEqual(closed.status_code, 200)
        self.assertEqual(closed.json()["phase"], "closed")
        self.assertEqual(closed.json()["legalActions"], [])
        self.assertEqual(self.client.post(url, json={"action": "next", "version": closed.json()["version"]}, headers=self.headers(101)).status_code, 409)


if __name__ == "__main__":
    unittest.main()
