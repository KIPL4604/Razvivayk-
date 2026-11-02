"""Real authenticated social routes against an isolated database."""
import hashlib
import hmac
import json
import os
from pathlib import Path
import tempfile
import time
import unittest
from unittest.mock import patch
from urllib.parse import urlencode
import uuid

from fastapi import FastAPI
from fastapi.testclient import TestClient
from webapp.backend import social
from webapp.backend.database import connection

TOKEN = 'social-contract-test-only'


def signed(user):
    data = {'auth_date': str(int(time.time())), 'user': json.dumps(user)}
    secret = hmac.new(b'WebAppData', TOKEN.encode(), hashlib.sha256).digest()
    data['hash'] = hmac.new(secret, '\n'.join(f'{k}={v}' for k, v in sorted(data.items())).encode(), hashlib.sha256).hexdigest()
    return urlencode(data)


class SocialTests(unittest.TestCase):
    def setUp(self):
        self.folder = tempfile.TemporaryDirectory()
        self.env = patch.dict(os.environ, {'TG_BOT_TOKEN': TOKEN, 'DATABASE_URL': '', 'GAME_DB_PATH': str(Path(self.folder.name)/'social.sqlite3')})
        self.env.start()
        social.init_social_db()
        app = FastAPI()
        app.include_router(social.router)
        self.client = TestClient(app)
        self.users = [{'id': i+700, 'first_name': f'Игрок {i}', 'username': f'test_{i}'} for i in range(3)]
        self.headers = [{'X-Init-Data': signed(u)} for u in self.users]
        self.codes = [self.call(i, 'GET', '/state').json()['me']['code'] for i in range(3)]

    def tearDown(self):
        self.client.close()
        self.env.stop()
        self.folder.cleanup()

    def call(self, who, method, path, body=None):
        return self.client.request(method, '/api/social'+path, headers=self.headers[who], json=body)

    def friend(self, a=0, b=1):
        self.assertEqual(self.call(a,'POST','/requests',{'code':self.codes[b]}).status_code,200)
        self.assertEqual(self.call(b,'POST',f'/requests/{self.codes[a]}/respond',{'accept':True}).status_code,200)

    def send(self, who=0, peer=1, text='Привет', nonce=None):
        return self.call(who,'POST',f'/friends/{self.codes[peer]}/messages',{'text':text,'clientId':nonce or str(uuid.uuid4())})

    def test_authentication_and_private_directory(self):
        self.assertEqual(self.client.get('/api/social/state').status_code,401)
        self.assertEqual(self.client.get('/api/social/me/qr').status_code,401)
        self.assertEqual(self.client.get('/api/social/state',headers={'X-Init-Data':self.headers[0]['X-Init-Data']+'x'}).status_code,401)
        self.assertEqual(self.call(0,'GET','/state').json()['friends'],[])
        self.assertEqual(self.call(0,'POST','/requests',{'code':self.codes[0]}).status_code,400)
        self.assertEqual(self.call(0,'POST','/requests',{'code':'not-a-code'}).status_code,422)
        self.assertEqual(self.send().status_code,403)

    def test_requests_consent_cancel_reject_reciprocal(self):
        code=self.codes[1]
        for _ in range(2):
            self.assertEqual(self.call(0,'POST','/requests',{'code':code}).json()['status'],'pending')
        self.assertEqual(len(self.call(1,'GET','/state').json()['incoming']),1)
        self.assertEqual(self.call(0,'POST',f'/requests/{code}/respond',{'accept':True}).status_code,409)
        self.call(1,'POST',f'/requests/{self.codes[0]}/respond',{'accept':False})
        self.assertEqual(self.call(0,'GET','/state').json()['outgoing'],[])
        self.call(0,'POST','/requests',{'code':code})
        self.call(0,'DELETE',f'/friends/{code}')
        self.assertEqual(self.call(1,'GET','/state').json()['incoming'],[])
        self.call(0,'POST','/requests',{'code':code})
        self.assertEqual(self.call(1,'POST','/requests',{'code':self.codes[0]}).json()['status'],'accepted')
        self.assertEqual(len(self.call(0,'GET','/state').json()['friends']),1)

    def test_message_acl_idempotence_unfriend_and_unread(self):
        self.friend()
        nonce=str(uuid.uuid4())
        sent=self.send(text='<script>alert(1)</script>',nonce=nonce)
        self.assertEqual(sent.status_code,200)
        mid=sent.json()['id']
        self.assertEqual(self.send(text='<script>alert(1)</script>',nonce=nonce).json()['id'],mid)
        self.assertEqual(self.send(text='changed',nonce=nonce).status_code,409)
        self.assertEqual(self.call(1,'GET','/state').json()['chats'][0]['unread'],1)
        self.assertEqual(self.call(2,'GET',f'/friends/{self.codes[0]}/messages').status_code,403)
        self.assertEqual(self.call(1,'POST',f'/friends/{self.codes[0]}/read',{'id':str(uuid.uuid4())}).status_code,404)
        self.assertEqual(self.call(1,'POST',f'/friends/{self.codes[0]}/read',{'id':mid}).status_code,200)
        self.assertEqual(self.call(1,'GET','/state').json()['chats'][0]['unread'],0)
        self.call(0,'DELETE',f'/friends/{self.codes[1]}')
        self.assertEqual(self.send().status_code,403)
        self.assertEqual(self.call(1,'GET',f'/friends/{self.codes[0]}/messages').status_code,403)
        self.assertEqual(self.call(1,'GET','/state').json()['chats'],[])

    def test_ordered_history_and_foreign_cursor(self):
        self.friend();self.friend(0,2)
        # Cursor behavior crosses the 50-message boundary without duplicates.
        for i in range(60):
            who=i%2
            self.assertEqual(self.send(who,1-who,str(i)).status_code,200)
        latest=self.call(0,'GET',f'/friends/{self.codes[1]}/messages').json()
        self.assertEqual([m['text'] for m in latest['messages']],[str(i) for i in range(10,60)])
        self.assertTrue(latest['hasMore'])
        older=self.call(0,'GET',f'/friends/{self.codes[1]}/messages?before='+latest['messages'][0]['id']).json()
        self.assertEqual([m['text'] for m in older['messages']],[str(i) for i in range(10)])
        self.assertFalse(older['hasMore'])
        other=self.send(0,2).json()['id']
        self.assertEqual(self.call(0,'GET',f'/friends/{self.codes[1]}/messages?after='+other).status_code,404)

    def test_presence_multiple_sessions_expiry(self):
        self.friend()
        a,b=str(uuid.uuid4()),str(uuid.uuid4())
        self.call(0,'POST','/presence',{'session':a,'active':True})
        self.call(0,'POST','/presence',{'session':b,'active':True})
        self.call(0,'POST','/presence',{'session':a,'active':False})
        self.assertTrue(self.call(1,'GET','/state').json()['friends'][0]['online'])
        self.call(0,'POST','/presence',{'session':b,'active':False})
        self.assertFalse(self.call(1,'GET','/state').json()['friends'][0]['online'])
        self.call(0,'POST','/presence',{'session':a,'active':True})
        with connection(write=True) as db:
            db.execute('UPDATE social_presence SET seen_at=?',(int(time.time())-70,))
        self.assertFalse(self.call(1,'GET','/state').json()['friends'][0]['online'])

    def test_qr_code_and_limits(self):
        qr=self.call(0,'GET','/me/qr')
        self.assertEqual(qr.status_code,200)
        self.assertTrue(qr.headers['content-type'].startswith('image/svg+xml'))
        self.assertIn('<svg',qr.text)
        self.assertIn('<path',qr.text)
        self.friend()
        for _ in range(40):
            self.assertEqual(self.send().status_code,200)
        self.assertEqual(self.send().status_code,429)
        self.assertEqual(self.send(text='   ').status_code,422)


if __name__=='__main__':
    unittest.main()
