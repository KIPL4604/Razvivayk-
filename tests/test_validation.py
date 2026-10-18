"""Issued puzzles, proof rejection and atomic campaign rewards."""
from collections import deque
from concurrent.futures import ThreadPoolExecutor
from copy import deepcopy
import json
import os
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit
import uuid

from webapp.backend import game_store as store
from webapp.backend import puzzles_server as puzzles


def tile_solution(board, size):
    """An independent shortest-path solver for the small test challenge."""
    start, goal = tuple(board), tuple((i+1) % len(board) for i in range(len(board)))
    queue, previous = deque([start]), {start: None}
    while queue:
        state = queue.popleft()
        if state == goal:
            path = []
            while previous[state] is not None:
                state, index = previous[state]
                path.append(index)
            return path[::-1]
        blank = state.index(0)
        for index in range(len(state)):
            if abs(index//size-blank//size)+abs(index % size-blank % size) != 1:
                continue
            next_state = list(state)
            next_state[index], next_state[blank] = next_state[blank], next_state[index]
            next_state = tuple(next_state)
            if next_state not in previous:
                previous[next_state] = (state,index)
                queue.append(next_state)
    raise AssertionError("Sliding puzzle is unsolvable")


def solution_proof(puzzle):
    game = puzzle["type"]
    if game in ("sudoku","nonogram"):
        return {"board": puzzle["solution"][:]}
    if game == "tiles":
        return {"board": [(i+1) % len(puzzle["board"]) for i in range(len(puzzle["board"]))], "tileMoves": tile_solution(puzzle["board"],puzzle["size"])}
    if game == "memory":
        groups = {}
        for card in puzzle["cards"]:
            groups.setdefault(card["value"],[]).append(card["id"])
        return {"pairs": list(groups.values())}
    if game == "pattern":
        return {"patterns": deepcopy(puzzle["patterns"])}
    return {"answers": [q["ink"] if game == "stroop" else q["answers"][0] for q in puzzle["questions"]]}


class PuzzleGenerationTests(unittest.TestCase):
    def test_all_thousand_stages_preserve_game_invariants(self):
        for game in store.GAME_NAMES:
            fingerprints = set()
            for number in range(1,101):
                with self.subTest(game=game,number=number):
                    difficulty = store.level_config(number,game)["difficulty"]
                    puzzle = puzzles.create_challenge(game,difficulty,number,"stable-test-session")
                    again = puzzles.create_challenge(game,difficulty,number,"stable-test-session")
                    puzzle["startedAt"] = again["startedAt"] = 0
                    self.assertEqual(puzzle,again)
                    fingerprints.add(json.dumps(puzzle,sort_keys=True))
                    self.assertEqual(puzzle["levelNumber"],number)
                    if game == "sudoku":
                        self.assertEqual(puzzles.count_sudoku_solutions(puzzle["board"]),1)
                        self.assertEqual(puzzles.count_sudoku_solutions(puzzle["solution"]),1)
                        self.assertTrue(all(not v or v == puzzle["solution"][i] for i,v in enumerate(puzzle["board"])))
                        self.assertGreaterEqual(sum(puzzle["given"]),30)
                    elif game == "nonogram":
                        self.assertEqual(puzzles.count_nonogram_solutions(puzzle["rowClues"],puzzle["colClues"]),1)
                    elif game == "memory":
                        for symbol in {c["value"] for c in puzzle["cards"]}:
                            self.assertEqual(sum(c["value"] == symbol for c in puzzle["cards"]),2)
                    elif game == "tiles":
                        values, size = [v for v in puzzle["board"] if v], puzzle["size"]
                        inversions = sum(v > w for i,v in enumerate(values) for w in values[i+1:])
                        blank_row = size-puzzle["board"].index(0)//size
                        self.assertEqual(inversions % 2 if size % 2 else (inversions+blank_row) % 2,0 if size % 2 else 1)
                        self.assertNotEqual(puzzle["board"],[(i+1) % (size*size) for i in range(size*size)])
                    elif game == "pattern":
                        for pattern in puzzle["patterns"]:
                            self.assertEqual(len(set(pattern)),len(pattern))
                    elif game == "stroop":
                        self.assertTrue(all(q["ink"] != q["word"] for q in puzzle["questions"]))
                    elif game == "arithmetic":
                        for question in puzzle["questions"]:
                            expression = question["question"].replace(" = ?","").replace("×","*").replace("÷","//").replace("−","-")
                            self.assertRegex(expression,r"^[0-9+*\/() -]+$")
                            self.assertEqual(int(question["answers"][0]),eval(expression,{"__builtins__":{}},{}))
                    else:
                        self.assertTrue(all(q["question"] and q["answers"] and q["hint"] for q in puzzle["questions"]))
            self.assertEqual(len(fingerprints),100)

    def test_every_game_accepts_correct_evidence_and_rejects_mutation(self):
        for game in store.GAME_NAMES:
            with self.subTest(game=game):
                challenge = puzzles.create_challenge(game,"easy",1,"proof-tests")
                proof = solution_proof(challenge)
                self.assertTrue(puzzles.validate_proof(challenge,proof))
                invalid = deepcopy(proof)
                if "board" in invalid:
                    invalid["board"][0] = 0 if game == "sudoku" else 99
                elif "pairs" in invalid:
                    invalid["pairs"][0][1] = invalid["pairs"][0][0]
                elif "patterns" in invalid:
                    invalid["patterns"][0][1] = invalid["patterns"][0][0]
                else:
                    invalid["answers"][0] = 99 if game == "stroop" else "Неверный ответ"
                with self.assertRaises(puzzles.InvalidProof):
                    puzzles.validate_proof(challenge,invalid)
                with self.assertRaises(puzzles.InvalidProof):
                    puzzles.validate_proof(challenge,{"completed": True,"solution": challenge.get("solution")})
                with self.assertRaises(puzzles.InvalidProof):
                    puzzles.validate_proof(challenge,None)

    def test_tiles_replay_legal_path_including_undo(self):
        challenge = puzzles.create_challenge("tiles","easy",1,"tile-path")
        proof = solution_proof(challenge)
        first, blank = proof["tileMoves"][0], challenge["board"].index(0)
        proof["tileMoves"] = [first,blank,*proof["tileMoves"]]
        self.assertTrue(puzzles.validate_proof(challenge,proof))
        proof["tileMoves"] = [challenge["board"].index(0)]
        with self.assertRaises(puzzles.InvalidProof):
            puzzles.validate_proof(challenge,proof)

    def test_types_lengths_duplicates_and_server_givens(self):
        sudoku = puzzles.create_challenge("sudoku","easy",1,"givens")
        swapped = [2 if n == 1 else 1 if n == 2 else n for n in sudoku["solution"]]
        self.assertEqual(puzzles.count_sudoku_solutions(swapped),1)
        with self.assertRaises(puzzles.InvalidProof):
            puzzles.validate_proof(sudoku,{"board":swapped})
        for board in ([True]*81,[1]*80,[1]*82,["1"]*81):
            with self.assertRaises(puzzles.InvalidProof):
                puzzles.validate_proof(sudoku,{"board":board})
        memory = puzzles.create_challenge("memory","easy",1,"pairs")
        valid = solution_proof(memory)
        valid["pairs"][1] = valid["pairs"][0]
        with self.assertRaises(puzzles.InvalidProof):
            puzzles.validate_proof(memory,valid)
        question = puzzles.create_challenge("arithmetic","easy",1,"answers")
        for proof in ({"answers":[]},{"answers":[True]*3},{"answers":["x"*257]*3},{"answers":{"0":"1"}}):
            with self.assertRaises(puzzles.InvalidProof):
                puzzles.validate_proof(question,proof)

    def test_nonogram_cross_marks_and_answer_normalization(self):
        nonogram = puzzles.create_challenge("nonogram","easy",1,"crosses")
        board = [value if value else -1 for value in nonogram["solution"]]
        self.assertTrue(puzzles.validate_proof(nonogram,{"board":board}))
        challenge = {"type":"rebuses","serverChallengeVersion":1,"questions":[{"answers":["Ёлка"]}]}
        self.assertTrue(puzzles.validate_proof(challenge,{"answers":[" елка! "]}))


class ValidationStoreTests(unittest.TestCase):
    def setUp(self):
        self.folder = tempfile.TemporaryDirectory()
        self.env = patch.dict(os.environ,{"GAME_DB_PATH":str(Path(self.folder.name)/"validation.sqlite3"),"DATABASE_URL":""})
        self.env.start()
        store.init_database()
        self.user = {"id":5_000_000_101,"first_name":"Проверка"}

    def tearDown(self):
        self.env.stop()
        self.folder.cleanup()

    def start(self,game="sudoku"):
        session = store.start_session(self.user,1,game,"easy")
        with store._connection() as db:
            db.execute("UPDATE game_sessions SET started_at=started_at-10 WHERE session_id=?",(session["sessionId"],))
        return session

    def complete(self,session,proof=None,user=None):
        return store.complete_session(user or self.user,session["sessionId"],10,0,6,proof)

    def test_all_ten_games_award_only_after_stored_challenge_validation(self):
        for game in store.GAME_NAMES:
            session = self.start(game)
            with self.assertRaises(store.GameRuleError):
                self.complete(session,{"completed":True})
            with store._connection() as db:
                self.assertIsNone(db.execute("SELECT completed_at FROM game_sessions WHERE session_id=?",(session["sessionId"],)).fetchone()[0])
            done = self.complete(session,solution_proof(session["puzzle"]))
            self.assertFalse(done["alreadyCompleted"])
        self.assertEqual(store.get_profile(self.user)["completedCampaignLevels"],10)

    def test_session_and_account_isolation_and_immutable_challenge(self):
        first, second = self.start(), self.start()
        self.assertNotEqual(first["puzzle"]["solution"],second["puzzle"]["solution"])
        first["puzzle"]["solution"] = second["puzzle"]["solution"][:]
        with self.assertRaises(store.GameRuleError):
            self.complete(first,solution_proof(first["puzzle"]))
        with self.assertRaises(store.GameRuleError):
            self.complete(second,solution_proof(second["puzzle"]),{"id":202,"first_name":"Other"})
        self.assertEqual(store.get_profile(self.user)["xp"],0)

    def test_concurrent_duplicate_completions_award_exactly_once(self):
        session = self.start("memory")
        proof = solution_proof(session["puzzle"])
        with ThreadPoolExecutor(max_workers=6) as pool:
            results = list(pool.map(lambda _:self.complete(session,proof),range(6)))
        self.assertEqual(sum(not r["alreadyCompleted"] for r in results),1)
        profile = store.get_profile(self.user)
        self.assertEqual(profile["xp"],41)
        self.assertEqual(profile["totalGames"],1)
        self.assertEqual(profile["campaigns"]["memory"]["completedLevels"],[1])

    def test_old_pending_session_requires_restart_and_migration_is_repeatable(self):
        session = self.start()
        with store._connection() as db:
            db.execute("ALTER TABLE game_sessions DROP COLUMN challenge")
        store.init_database()
        store.init_database()
        with self.assertRaisesRegex(store.GameRuleError,"заново"):
            self.complete(session,solution_proof(session["puzzle"]))
        self.assertEqual(store.get_profile(self.user)["xp"],0)
        fresh = self.start()
        self.assertFalse(self.complete(fresh,solution_proof(fresh["puzzle"]))["alreadyCompleted"])

    def test_finished_session_stays_idempotent_without_requiring_resend(self):
        session = self.start("arithmetic")
        done = self.complete(session,solution_proof(session["puzzle"]))
        again = self.complete(session)
        self.assertTrue(again["alreadyCompleted"])
        self.assertEqual(again["profile"]["xp"],done["profile"]["xp"])


@unittest.skipUnless(os.getenv("TERAMONT_TEST_POSTGRES_URL"), "Set TERAMONT_TEST_POSTGRES_URL to an isolated test database")
class PostgreSQLValidationTests(ValidationStoreTests):
    """Run the proof/reward contract in a private schema on real PostgreSQL."""
    def setUp(self):
        import psycopg
        from psycopg import sql
        self.url = os.environ["TERAMONT_TEST_POSTGRES_URL"]
        self.schema = "validation_test_"+uuid.uuid4().hex
        with psycopg.connect(self.url) as raw:
            raw.execute(sql.SQL("CREATE SCHEMA {}").format(sql.Identifier(self.schema)))
        self.addCleanup(self._drop_schema)
        parts = urlsplit(self.url)
        query = dict(parse_qsl(parts.query))
        query["options"] = "-csearch_path="+self.schema
        scoped_url = urlunsplit(parts._replace(query=urlencode(query)))
        self.env = patch.dict(os.environ,{"DATABASE_URL":scoped_url,"POKER_DB_PATH":""})
        self.env.start()
        self.addCleanup(self.env.stop)
        store.init_database()
        self.user = {"id":5_000_000_101,"first_name":"PostgreSQL проверка"}

    def tearDown(self):
        # addCleanup restores the environment and drops only this test's schema,
        # including when setup or an assertion fails.
        pass

    def _drop_schema(self):
        import psycopg
        from psycopg import sql
        with psycopg.connect(self.url) as raw:
            raw.execute(sql.SQL("DROP SCHEMA {} CASCADE").format(sql.Identifier(self.schema)))

    def test_bigint_profile_id_and_challenge_persisted_in_private_schema(self):
        session = self.start("arithmetic")
        with store._connection() as db:
            self.assertEqual(db.dialect,"postgres")
            self.assertEqual(db.execute("SELECT current_schema()").fetchone()[0],self.schema)
            self.assertEqual(db.execute("SELECT data_type FROM information_schema.columns WHERE table_schema=current_schema() AND table_name='game_profiles' AND column_name='user_id'").fetchone()[0],"bigint")
            row = db.execute("SELECT user_id,challenge FROM game_sessions WHERE session_id=?",(session["sessionId"],)).fetchone()
            self.assertEqual(row["user_id"],self.user["id"])
            self.assertEqual(json.loads(row["challenge"]),session["puzzle"])


if __name__ == "__main__":
    unittest.main()
