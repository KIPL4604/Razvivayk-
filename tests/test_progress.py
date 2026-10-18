import hashlib
import hmac
import json
import os
from pathlib import Path
import sqlite3
import tempfile
import time
import unittest
from unittest.mock import patch
from urllib.parse import urlencode

from webapp.backend import game_store as store
from webapp.backend.auth import verify_init_data
from test_validation import solution_proof


class ProgressTests(unittest.TestCase):
    def setUp(self):
        self.folder = tempfile.TemporaryDirectory()
        self.env = patch.dict(os.environ, {'GAME_DB_PATH': str(Path(self.folder.name)/'profile.sqlite3'),'DATABASE_URL':''})
        self.env.start()
        store.init_database()
        self.user = {'id': 101, 'first_name': 'Player'}

    def tearDown(self):
        self.env.stop()
        self.folder.cleanup()

    def finish(self, session, user=None):
        with store._connection() as db:
            db.execute('UPDATE game_sessions SET started_at=started_at-10 WHERE session_id=?', (session['sessionId'],))
        return store.complete_session(user or self.user, session['sessionId'], 10, 0, 6, solution_proof(session['puzzle']))

    def test_independent_campaigns_and_retries(self):
        first = store.start_session(self.user, 1, 'sudoku', 'easy')
        with self.assertRaises(store.GameRuleError):
            store.start_session(self.user, 2, 'sudoku', 'easy')
        completed = self.finish(first)
        self.assertEqual(completed['profile']['campaigns']['sudoku']['unlockedLevel'], 2)
        self.assertEqual(completed['profile']['campaigns']['memory']['unlockedLevel'], 1)
        retry = self.finish(first)
        self.assertTrue(retry['alreadyCompleted'])
        self.assertEqual(retry['profile']['xp'], completed['profile']['xp'])
        self.assertEqual(retry['profile']['totalGames'], 1)

    def test_account_isolation(self):
        session = store.start_session(self.user, 1, 'memory', 'easy')
        other = {'id': 202, 'first_name': 'Other'}
        with self.assertRaises(store.GameRuleError):
            self.finish(session, other)
        self.finish(session)
        self.assertEqual(store.get_profile(other)['xp'], 0)

    def test_ten_campaigns_and_replay_reward(self):
        for game in store.GAME_NAMES:
            self.finish(store.start_session(self.user, 1, game, 'easy'))
        player = store.get_profile(self.user)
        self.assertEqual(len(player['campaigns']), 10)
        self.assertEqual(player['completedCampaignLevels'], 10)
        self.assertTrue(next(a for a in player['achievements'] if a['id']=='all_games')['unlocked'])
        replay = self.finish(store.start_session(self.user, 1, 'sudoku', 'easy'))
        self.assertEqual(replay['xpAwarded'], 15)
        self.assertEqual(replay['profile']['completedCampaignLevels'], 10)

    def test_streak_expiry_and_next_day(self):
        session = store.start_session(self.user, 1, 'stroop', 'easy')
        today = store.datetime.now(store.DAY_ZONE).date()
        with store._connection() as db:
            db.execute('UPDATE game_profiles SET current_streak=6,best_streak=6,last_played_date=? WHERE user_id=?', ((today-store.timedelta(days=1)).isoformat(),101))
        done = self.finish(session)
        self.assertEqual(done['profile']['streak'],7)
        with store._connection() as db:
            db.execute('UPDATE game_profiles SET last_played_date=? WHERE user_id=?', ((today-store.timedelta(days=3)).isoformat(),101))
        self.assertEqual(store.get_profile(self.user)['streak'],0)
        self.assertEqual(store.get_profile(self.user)['bestStreak'],7)

    def test_migration_is_repeatable(self):
        session = store.start_session(self.user, 1, 'sudoku', 'easy')
        self.finish(session)
        with store._connection() as db:
            db.execute('DROP INDEX ix_campaign_progress')
            db.execute('ALTER TABLE game_sessions DROP COLUMN campaign_id')
            db.execute('UPDATE game_sessions SET level_number=5')
        store.init_database()
        store.init_database()
        player = store.get_profile(self.user)
        self.assertEqual(player['campaigns']['sudoku']['completedLevels'],[2])
        self.assertEqual(player['campaigns']['sudoku']['unlockedLevel'],1)

    def test_signature_and_expiry(self):
        token='test-key-for-hmac'
        data={'auth_date':str(int(time.time())),'user':json.dumps(self.user)}
        def sign(values):
            secret=hmac.new(b'WebAppData',token.encode(),hashlib.sha256).digest()
            check='\n'.join(f'{k}={v}' for k,v in sorted(values.items()))
            return urlencode({**values,'hash':hmac.new(secret,check.encode(),hashlib.sha256).hexdigest()})
        with patch.dict(os.environ,{'TG_BOT_TOKEN':token}):
            self.assertEqual(verify_init_data(sign(data))['id'],101)
            self.assertIsNone(verify_init_data(sign(data).replace('101','202')))
            self.assertIsNone(verify_init_data(sign({**data,'auth_date':str(int(time.time())-90000)})))


if __name__ == '__main__':
    unittest.main()
