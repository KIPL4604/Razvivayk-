"""Consent-based friends, Mini App presence and private text conversations."""
from __future__ import annotations

import io
import re
import secrets
import time
import uuid
from urllib.parse import urlparse

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel, Field

from .auth import get_current_user
from .database import connection
from . import realtime

router = APIRouter(prefix='/api/social', tags=['friends'])
CODE = re.compile(r'^RZ-[A-F0-9]{12}$')


def init_social_db():
    with connection(write=True) as db:
        db.executescript('''
        CREATE TABLE IF NOT EXISTS social_accounts (
          user_id BIGINT PRIMARY KEY, code TEXT NOT NULL UNIQUE, name TEXT NOT NULL,
          username TEXT NOT NULL, photo TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS social_links (
          low_id BIGINT NOT NULL, high_id BIGINT NOT NULL, requested_by BIGINT NOT NULL,
          status TEXT NOT NULL, updated_at BIGINT NOT NULL, PRIMARY KEY(low_id,high_id));
        CREATE INDEX IF NOT EXISTS social_links_high ON social_links(high_id,status);
        CREATE TABLE IF NOT EXISTS social_presence (
          user_id BIGINT NOT NULL, session_id TEXT NOT NULL, seen_at BIGINT NOT NULL,
          active INTEGER NOT NULL, PRIMARY KEY(user_id,session_id));
        CREATE TABLE IF NOT EXISTS social_messages (
          id TEXT PRIMARY KEY, low_id BIGINT NOT NULL, high_id BIGINT NOT NULL,
          sender_id BIGINT NOT NULL, body TEXT NOT NULL, created_at BIGINT NOT NULL,
          client_id TEXT NOT NULL, UNIQUE(sender_id,client_id));
        CREATE INDEX IF NOT EXISTS social_messages_pair ON social_messages(low_id,high_id,created_at,id);
        CREATE TABLE IF NOT EXISTS social_reads (
          user_id BIGINT NOT NULL, peer_id BIGINT NOT NULL, stamp BIGINT NOT NULL,
          message_id TEXT NOT NULL, PRIMARY KEY(user_id,peer_id));
        CREATE TABLE IF NOT EXISTS social_limits (
          user_id BIGINT NOT NULL, kind TEXT NOT NULL, window BIGINT NOT NULL,
          used INTEGER NOT NULL, PRIMARY KEY(user_id,kind));
        ''')


def account(db, user):
    uid = int(user['id'])
    db.lock(f'social-account:{uid}')
    photo = str(user.get('photo_url') or '')[:2048]
    parsed = urlparse(photo)
    if parsed.scheme != 'https' or not parsed.hostname or parsed.username or parsed.password:
        photo = ''
    name = ' '.join(str(user.get(k) or '') for k in ('first_name', 'last_name')).strip()[:100] or 'Игрок'
    db.execute('''INSERT INTO social_accounts(user_id,code,name,username,photo) VALUES(?,?,?,?,?)
      ON CONFLICT(user_id) DO UPDATE SET name=excluded.name,username=excluded.username,photo=excluded.photo''',
      (uid, 'RZ-' + secrets.token_hex(6).upper(), name, str(user.get('username') or '')[:64], photo))
    return db.execute('SELECT * FROM social_accounts WHERE user_id=?', (uid,)).fetchone()


def person(row):
    return {'code': row['code'], 'name': row['name'], 'username': row['username'], 'photo': row['photo']}


def peer(db, code):
    code = code.strip().upper()
    if not CODE.fullmatch(code):
        raise HTTPException(422, 'Код выглядит так: RZ-012345ABCDEF')
    row = db.execute('SELECT * FROM social_accounts WHERE code=?', (code,)).fetchone()
    if row is None:
        raise HTTPException(404, 'Игрок с таким кодом ещё не заходил в Развивайку')
    return row


def pair(uid, pid):
    if uid == pid:
        raise HTTPException(400, 'Это твой собственный код')
    return tuple(sorted((uid, pid)))


def link(db, uid, pid, accepted=False):
    ids = pair(uid, pid)
    db.lock(f'social-pair:{ids[0]}:{ids[1]}')
    row = db.execute('SELECT * FROM social_links WHERE low_id=? AND high_id=?', ids).fetchone()
    if accepted and (not row or row['status'] != 'accepted'):
        raise HTTPException(403, 'Переписка доступна после принятия заявки в друзья')
    return ids, row


def limited(db, uid, kind, maximum):
    db.lock(f'social-limit:{uid}:{kind}')
    window = int(time.time()) // 60
    row = db.execute('SELECT window,used FROM social_limits WHERE user_id=? AND kind=?', (uid, kind)).fetchone()
    used = row['used'] if row and row['window'] == window else 0
    if used >= maximum:
        raise HTTPException(429, 'Слишком часто. Попробуй через минуту')
    db.execute('''INSERT INTO social_limits VALUES(?,?,?,?) ON CONFLICT(user_id,kind)
      DO UPDATE SET window=excluded.window,used=excluded.used''', (uid, kind, window, used + 1))


def changed(*uids):
    for uid in set(uids):
        realtime.publish(f'user:{uid}', {'type': 'social.changed'})


def message(row, uid):
    return {'id': row['id'], 'text': row['body'], 'mine': row['sender_id'] == uid,
            'createdAt': row['created_at'] // 1000, 'clientId': row['client_id']}


class Presence(BaseModel):
    session: str = Field(pattern=r'^[a-zA-Z0-9-]{16,64}$')
    active: bool


class RequestFriend(BaseModel):
    code: str = Field(min_length=3, max_length=64)


class Respond(BaseModel):
    accept: bool


class SendMessage(BaseModel):
    text: str = Field(min_length=1, max_length=2000)
    clientId: str = Field(pattern=r'^[a-zA-Z0-9-]{16,64}$')


class ReadMessages(BaseModel):
    id: str = Field(min_length=36, max_length=36)


@router.get('/state')
def state(user: dict = Depends(get_current_user)):
    uid, now = int(user['id']), int(time.time())
    with connection(write=True) as db:
        me = person(account(db, user))
        rows = db.execute('''SELECT l.*,a.* FROM social_links l JOIN social_accounts a
          ON a.user_id=CASE WHEN l.low_id=? THEN l.high_id ELSE l.low_id END
          WHERE l.low_id=? OR l.high_id=?''', (uid, uid, uid)).fetchall()
        friends, incoming, outgoing, chats = [], [], [], []
        for row in rows:
            item, pid = person(row), row['user_id']
            if row['status'] != 'accepted':
                (outgoing if row['requested_by'] == uid else incoming).append(item)
                continue
            presence = db.execute('''SELECT MAX(seen_at) AS seen,
              MAX(CASE WHEN active=1 AND seen_at>? THEN 1 ELSE 0 END) AS online
              FROM social_presence WHERE user_id=?''', (now - 65, pid)).fetchone()
            item.update(online=bool(presence['online']), lastSeen=presence['seen'])
            friends.append(item)
            ids = tuple(sorted((uid, pid)))
            last = db.execute('''SELECT * FROM social_messages WHERE low_id=? AND high_id=?
              ORDER BY created_at DESC,id DESC LIMIT 1''', ids).fetchone()
            if last:
                read = db.execute('SELECT stamp,message_id FROM social_reads WHERE user_id=? AND peer_id=?', (uid, pid)).fetchone()
                unread = db.execute('''SELECT COUNT(*) FROM social_messages WHERE low_id=? AND high_id=?
                  AND sender_id=? AND (created_at>? OR (created_at=? AND id>?))''',
                  (*ids, pid, read['stamp'] if read else 0, read['stamp'] if read else 0, read['message_id'] if read else '')).fetchone()[0]
                chats.append({**item, 'last': message(last, uid), 'unread': unread})
    friends.sort(key=lambda x: (not x['online'], x['name'].casefold(), x['code']))
    chats.sort(key=lambda x: (x['last']['createdAt'], x['last']['id']), reverse=True)
    return dict(me=me, friends=friends, incoming=incoming, outgoing=outgoing, chats=chats)


@router.post('/presence')
def presence(body: Presence, user: dict = Depends(get_current_user)):
    uid, now = int(user['id']), int(time.time())
    with connection(write=True) as db:
        account(db, user)
        limited(db, uid, 'presence', 120)
        db.execute('DELETE FROM social_presence WHERE user_id=? AND seen_at<?', (uid, now - 86400))
        sessions = db.execute('SELECT session_id FROM social_presence WHERE user_id=? ORDER BY seen_at DESC,session_id', (uid,)).fetchall()
        for expired in sessions[15:]:
            db.execute('DELETE FROM social_presence WHERE user_id=? AND session_id=?', (uid, expired['session_id']))
        db.execute('''INSERT INTO social_presence VALUES(?,?,?,?) ON CONFLICT(user_id,session_id)
          DO UPDATE SET seen_at=excluded.seen_at,active=excluded.active''', (uid, body.session, now, int(body.active)))
    return {'ok': True}


@router.post('/requests')
def request_friend(body: RequestFriend, user: dict = Depends(get_current_user)):
    uid, now = int(user['id']), int(time.time())
    with connection(write=True) as db:
        account(db, user)
        limited(db, uid, 'requests', 12)
        target = peer(db, body.code)
        ids, previous = link(db, uid, target['user_id'])
        if not previous:
            count = db.execute('SELECT COUNT(*) FROM social_links WHERE low_id=? OR high_id=?', (uid, uid)).fetchone()[0]
            target_count = db.execute('SELECT COUNT(*) FROM social_links WHERE low_id=? OR high_id=?', (target['user_id'], target['user_id'])).fetchone()[0]
            if max(count, target_count) >= 200:
                raise HTTPException(409, 'Достигнут предел в 200 друзей и заявок')
        status = 'accepted' if previous and (previous['status'] == 'accepted' or previous['requested_by'] != uid) else 'pending'
        db.execute('''INSERT INTO social_links VALUES(?,?,?,?,?) ON CONFLICT(low_id,high_id)
          DO UPDATE SET status=excluded.status,updated_at=excluded.updated_at''', (*ids, uid, status, now))
    changed(uid, target['user_id'])
    return {'status': status}


@router.post('/requests/{code}/respond')
def respond(code: str, body: Respond, user: dict = Depends(get_current_user)):
    uid = int(user['id'])
    with connection(write=True) as db:
        target = peer(db, code)
        ids, previous = link(db, uid, target['user_id'])
        if not previous or previous['status'] != 'pending' or previous['requested_by'] == uid:
            raise HTTPException(409, 'Входящая заявка уже недоступна')
        if body.accept:
            db.execute("UPDATE social_links SET status='accepted',updated_at=? WHERE low_id=? AND high_id=?", (int(time.time()), *ids))
        else:
            db.execute('DELETE FROM social_links WHERE low_id=? AND high_id=?', ids)
    changed(uid, target['user_id'])
    return {'ok': True}


@router.delete('/friends/{code}')
def remove(code: str, user: dict = Depends(get_current_user)):
    uid = int(user['id'])
    with connection(write=True) as db:
        target = peer(db, code)
        ids, _ = link(db, uid, target['user_id'])
        db.execute('DELETE FROM social_links WHERE low_id=? AND high_id=?', ids)
    changed(uid, target['user_id'])
    return {'ok': True}


@router.get('/friends/{code}/messages')
def messages(code: str, before: str | None = None, after: str | None = None, user: dict = Depends(get_current_user)):
    if before and after:
        raise HTTPException(422, 'Выбери одно направление истории')
    uid = int(user['id'])
    with connection(write=True) as db:
        target = peer(db, code)
        ids, _ = link(db, uid, target['user_id'], accepted=True)
        params = list(ids)
        extra = ''
        if cursor := before or after:
            row = db.execute('SELECT * FROM social_messages WHERE id=? AND low_id=? AND high_id=?', (cursor, *ids)).fetchone()
            if row is None:
                raise HTTPException(404, 'Сообщение не найдено в этой переписке')
            op = '<' if before else '>'
            extra = f' AND (created_at{op}? OR (created_at=? AND id{op}?))'
            params.extend((row['created_at'], row['created_at'], row['id']))
        order = 'ASC' if after else 'DESC'
        rows = db.execute(f'''SELECT * FROM social_messages WHERE low_id=? AND high_id=?{extra}
          ORDER BY created_at {order},id {order} LIMIT 51''', params).fetchall()
        has_more = len(rows) > 50
        rows = rows[:50]
        if not after:
            rows.reverse()
        return {'messages': [message(row, uid) for row in rows], 'hasMore': has_more}


@router.post('/friends/{code}/messages')
def send(code: str, body: SendMessage, user: dict = Depends(get_current_user)):
    uid = int(user['id'])
    text = body.text.strip()
    if not text or '\x00' in text:
        raise HTTPException(422, 'Напиши сообщение')
    with connection(write=True) as db:
        target = peer(db, code)
        ids, _ = link(db, uid, target['user_id'], accepted=True)
        db.lock(f'social-send:{uid}')
        row = db.execute('SELECT * FROM social_messages WHERE sender_id=? AND client_id=?', (uid, body.clientId)).fetchone()
        if row:
            if (row['low_id'], row['high_id']) != ids or row['body'] != text:
                raise HTTPException(409, 'Этот идентификатор уже использован')
            return message(row, uid)
        limited(db, uid, 'messages', 40)
        mid, stamp = str(uuid.uuid4()), time.time_ns() // 1000
        # Serialize each conversation and keep cursor order monotonic even if the clock moves back.
        last = db.execute('SELECT MAX(created_at) FROM social_messages WHERE low_id=? AND high_id=?', ids).fetchone()[0]
        stamp = max(stamp, (last or 0) + 1)
        db.execute('INSERT INTO social_messages VALUES(?,?,?,?,?,?,?)', (mid, *ids, uid, text, stamp, body.clientId))
        row = db.execute('SELECT * FROM social_messages WHERE id=?', (mid,)).fetchone()
    changed(uid, target['user_id'])
    return message(row, uid)


@router.post('/friends/{code}/read')
def read(code: str, body: ReadMessages, user: dict = Depends(get_current_user)):
    uid = int(user['id'])
    with connection(write=True) as db:
        target = peer(db, code)
        ids, _ = link(db, uid, target['user_id'], accepted=True)
        row = db.execute('SELECT * FROM social_messages WHERE id=? AND low_id=? AND high_id=?', (body.id, *ids)).fetchone()
        if not row:
            raise HTTPException(404, 'Сообщение не найдено')
        db.execute('''INSERT INTO social_reads VALUES(?,?,?,?) ON CONFLICT(user_id,peer_id)
          DO UPDATE SET stamp=excluded.stamp,message_id=excluded.message_id
          WHERE social_reads.stamp<excluded.stamp OR
          (social_reads.stamp=excluded.stamp AND social_reads.message_id<excluded.message_id)''', (uid, target['user_id'], row['created_at'], row['id']))
    changed(uid)
    return {'ok': True}


@router.get('/me/qr')
def qr(user: dict = Depends(get_current_user)):
    import qrcode
    from qrcode.image.svg import SvgPathFillImage
    with connection(write=True) as db:
        code = account(db, user)['code']
    image = qrcode.make(code, image_factory=SvgPathFillImage, border=4)
    output = io.BytesIO()
    image.save(output)
    return Response(output.getvalue(), media_type='image/svg+xml', headers={'Cache-Control': 'no-store'})
