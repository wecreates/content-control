"""Local durable price state/outbox boundary. No network or delivery capability."""
import os
import json
import hashlib
from datetime import datetime, timedelta
import sqlite3
import sys
from pricewatch_price import create_watch, extract_price, observe_watch
from pricewatch_price.__main__ import MAX_REQUEST_BYTES, unique_pairs, no_constants


def record(db_path, request, *, before_commit=None):
    scope, watch = request['scope_id'], request['watch_id']
    operation=request.get('operation','record')
    if operation not in {'record','delete_watch','check_watch','deleted_watches'}:
        return {'status':'rejected','reason':'invalid_operation'}
    initial = create_watch(scope, watch, currency=request.get('currency','USD'),
                           minimum_drop=request.get('minimum_drop', '0'),
                           minimum_drop_percent=request.get('minimum_drop_percent', '0'))
    if initial['status'] == 'rejected':
        return initial
    connection = sqlite3.connect(db_path, timeout=5)
    try:
        connection.execute('PRAGMA synchronous=FULL')
        connection.execute('CREATE TABLE IF NOT EXISTS price_states (scope TEXT NOT NULL, watch TEXT NOT NULL, state TEXT NOT NULL, PRIMARY KEY(scope,watch))')
        connection.execute('CREATE TABLE IF NOT EXISTS price_outbox (event_id TEXT PRIMARY KEY, scope TEXT NOT NULL, watch TEXT NOT NULL, event TEXT NOT NULL)')
        connection.execute('BEGIN IMMEDIATE')
        if 'epoch' not in {row[1] for row in connection.execute('PRAGMA table_info(price_states)')}:
            connection.execute('ALTER TABLE price_states ADD COLUMN epoch TEXT')
        connection.execute('CREATE TABLE IF NOT EXISTS runtime_owner (slot INTEGER PRIMARY KEY CHECK(slot=1), pid INTEGER NOT NULL, token TEXT NOT NULL)')
        owner_pid, owner_token = request.get('runtime_pid'), request.get('runtime_token')
        if type(owner_pid) is not int or owner_pid <= 0 or not isinstance(owner_token,str) or not owner_token:
            return {'status':'rejected','reason':'invalid_runtime_owner'}
        owner = connection.execute('SELECT pid,token FROM runtime_owner WHERE slot=1').fetchone()
        if owner and owner != (owner_pid, owner_token):
            try:
                os.kill(owner[0], 0)
            except ProcessLookupError:
                pass
            except PermissionError:
                return {'status':'rejected','reason':'runtime_owner_unverifiable'}
            else:
                return {'status':'rejected','reason':'another_runtime_owns_database'}
        connection.execute('INSERT INTO runtime_owner VALUES (1,?,?) ON CONFLICT(slot) DO UPDATE SET pid=excluded.pid,token=excluded.token',(owner_pid,owner_token))
        connection.execute('CREATE TABLE IF NOT EXISTS price_tombstones (scope TEXT NOT NULL, watch TEXT NOT NULL, PRIMARY KEY(scope,watch))')
        deleted=connection.execute('SELECT 1 FROM price_tombstones WHERE scope=? AND watch=?',(scope,watch)).fetchone() is not None
        if operation=='delete_watch':
            connection.execute('INSERT OR IGNORE INTO price_tombstones VALUES (?,?)',(scope,watch))
            connection.execute('DELETE FROM price_states WHERE scope=? AND watch=?',(scope,watch))
            connection.execute('DELETE FROM price_outbox WHERE scope=? AND watch=?',(scope,watch))
            if before_commit:
                before_commit()
            connection.commit()
            return {'status':'deleted'}
        if operation=='deleted_watches':
            ids=request.get('watch_ids')
            if not isinstance(ids,list) or len(ids)>100 or any(create_watch(scope,x,currency='USD')['status']=='rejected' for x in ids):
                return {'status':'rejected','reason':'invalid_watch_ids'}
            removed=[x for x in ids if connection.execute('SELECT 1 FROM price_tombstones WHERE scope=? AND watch=?',(scope,x)).fetchone()]
            connection.commit()
            return {'status':'inspected','deleted_ids':removed}
        if deleted:
            connection.commit()
            return {'status':'deleted'}
        # Persisted admission bounds are not a retention/expiry policy. Never
        # delete undelivered candidates merely to admit another observation.
        connection.execute('CREATE TABLE IF NOT EXISTS price_outbox_limits (slot INTEGER PRIMARY KEY CHECK(slot=1), per_watch INTEGER NOT NULL, database_total INTEGER NOT NULL)')
        connection.execute('CREATE INDEX IF NOT EXISTS price_outbox_scope_watch ON price_outbox(scope,watch)')
        saved=connection.execute('SELECT per_watch,database_total FROM price_outbox_limits WHERE slot=1').fetchone()
        proposed=request.get('outbox_limits')
        if proposed is not None:
            if type(proposed) is not dict or set(proposed)!={'per_watch','database_total'} or type(proposed['per_watch']) is not int or type(proposed['database_total']) is not int or not 1<=proposed['per_watch']<=128 or not proposed['per_watch']<=proposed['database_total']<=10000:
                return {'status':'rejected','reason':'invalid_outbox_limits'}
            limits=(proposed['per_watch'],proposed['database_total'])
            if saved and saved!=limits:
                return {'status':'rejected','reason':'outbox_limits_migration_required'}
        else:
            limits=saved or (128,10000)
        if not saved:
            connection.execute('INSERT INTO price_outbox_limits VALUES (1,?,?)',limits)
        def at_capacity():
            per_watch=connection.execute('SELECT count(*) FROM price_outbox WHERE scope=? AND watch=?',(scope,watch)).fetchone()[0]
            total=connection.execute('SELECT count(*) FROM price_outbox').fetchone()[0]
            return per_watch>=limits[0] or total>=limits[1]
        if operation=='check_watch':
            full=at_capacity()
            connection.commit()
            return {'status':'capacity_blocked' if full else 'active'}
        observation = request.get('observation')
        if observation is None:
            observation = extract_price(request.get('html'), page_url=request.get('page_url'))
        row = connection.execute('SELECT state,epoch FROM price_states WHERE scope=? AND watch=?', (scope, watch)).fetchone()
        state = json.loads(row[0]) if row else initial['state']
        # Policy edits must use a separate, explicitly designed migration.
        if state['policy'] != initial['state']['policy']:
            return {'status':'rejected', 'reason':'policy_change_requires_migration'}
        # Validate/replay first; duplicates must never gain a second gap/event.
        epoch = request.get('continuity_epoch')
        if not isinstance(epoch, str) or not epoch or len(epoch)>128:
            return {'status':'rejected', 'reason':'invalid_continuity_epoch'}
        replay = observe_watch(state, observation, scope_id=scope, watch_id=watch,
                               observation_id=request['observation_id'], observed_at=request['observed_at'])
        if replay['status'] == 'rejected':
            return replay
        if replay['status'] != 'duplicate' and at_capacity():
            connection.commit()
            return {'status':'capacity_blocked'}
        if replay['status'] != 'duplicate' and row and row[1] != epoch and state['history']:
            # Restart or uncertain check: preserve pinned identity and history but
            # explicitly break continuity before considering this new observation.
            gap_time = datetime.fromisoformat(request['observed_at'].replace('Z','+00:00')) - timedelta(microseconds=1)
            gap_time = gap_time.strftime('%Y-%m-%dT%H:%M:%S.%fZ')
            gap = observe_watch(state, {'status':'unsupported','reason':'continuity_interrupted'},
                                scope_id=scope, watch_id=watch,
                                observation_id='gap_'+hashlib.sha256((epoch+request['observation_id']).encode()).hexdigest(),
                                observed_at=gap_time)
            if gap['status'] != 'recorded':
                return {'status':'rejected','reason':'gap_timestamp_not_ordered'}
            state = gap['state']
        result = observe_watch(state, observation, scope_id=scope, watch_id=watch,
                               observation_id=request['observation_id'], observed_at=request['observed_at'])
        if result['status'] == 'recorded':
            connection.execute('INSERT INTO price_states(scope,watch,state,epoch) VALUES (?,?,?,?) ON CONFLICT(scope,watch) DO UPDATE SET state=excluded.state,epoch=excluded.epoch', (scope, watch, json.dumps(result['state']),epoch))
            if result.get('event'):
                event = result['event']
                connection.execute('INSERT INTO price_outbox VALUES (?,?,?,?)', (event['event_id'], scope, watch, json.dumps(event)))
            if before_commit:
                before_commit()
            connection.commit()
        return {'status': result['status'], 'reason': result.get('reason'),
                'revision': result.get('state', state)['revision'],
                'monitoring_status': (result.get('state', state)['history'][-1]['outcome'] if result.get('state', state)['history'] else 'uninitialized'),
                'candidate_queued': bool(result.get('event')),
                'last_observed_at': (result.get('state',state)['history'][-1]['observed_at'] if result.get('state',state)['history'] else None),
                'last_price': (result.get('state',state)['history'][-1]['price'] if result.get('state',state)['history'] else None)}
    finally:
        connection.close()  # Uncommitted failure/rejection rolls back.


def main():
    try:
        raw = sys.stdin.buffer.read(MAX_REQUEST_BYTES + 1)
        if len(raw) > MAX_REQUEST_BYTES:
            raise ValueError('request_too_large')
        request = json.loads(raw, object_pairs_hook=unique_pairs, parse_constant=no_constants)
        result = record(sys.argv[1], request)
    except Exception:
        result = {'status':'rejected', 'reason':'price_transaction_failed'}
    print(json.dumps(result))
    return 2 if result['status'] == 'rejected' else 0

if __name__ == '__main__':
    raise SystemExit(main())
