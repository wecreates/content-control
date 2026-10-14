"""Shared strict IO and signed evidence helpers; Python 3.12 compatible."""
import hashlib
import hmac
import json
import os
import time
from pathlib import Path

PLATFORMS = {'kdp', 'redbubble', 'teepublic', 'zazzle', 'spreadshirt'}

def canonical(value):
    return json.dumps(value, sort_keys=True, separators=(',', ':'), ensure_ascii=False, allow_nan=False)

def digest(path):
    h = hashlib.sha256()
    with Path(path).open('rb') as f:
        for b in iter(lambda: f.read(1024 * 1024), b''):
            h.update(b)
    return h.hexdigest()

def read_json(path):
    if Path(path).stat().st_size > 4 * 1024 * 1024:
        raise ValueError('JSON_TOO_LARGE')
    return json.loads(Path(path).read_text())

def save_json(path, value):
    p = Path(path)
    p.parent.mkdir(parents=True, exist_ok=True)
    temp = p.with_name(p.name + '.tmp-' + os.urandom(6).hex())
    try:
        with temp.open('x') as f:
            f.write(canonical(value) + '\n')
            f.flush()
            os.fsync(f.fileno())
        os.replace(temp, p)
    finally:
        temp.unlink(missing_ok=True)

def verified(envelope, key_env, audience):
    key = os.environ.get(key_env, '')
    if len(key.encode()) < 32:
        raise ValueError('EVIDENCE_KEY_REQUIRED')
    payload = envelope.get('payload')
    if not isinstance(payload, str) or len(payload) > 4 * 1024 * 1024:
        raise ValueError('EVIDENCE_INVALID')
    signature = hmac.new(key.encode(), payload.encode(), hashlib.sha256).hexdigest()
    if not hmac.compare_digest(signature, str(envelope.get('signature', ''))):
        raise ValueError('EVIDENCE_SIGNATURE_INVALID')
    value = json.loads(payload)
    now = int(time.time() * 1000)
    if (not isinstance(value, dict) or value.get('audience') != audience
            or type(value.get('schema_version')) is not int or value['schema_version'] != 1):
        raise ValueError('EVIDENCE_SCOPE_INVALID')
    if (type(value.get('issued_at_ms')) is not int or type(value.get('expires_at_ms')) is not int
            or value['expires_at_ms'] - value['issued_at_ms'] > 900000):
        raise ValueError('EVIDENCE_TIME_INVALID')
    if not value['issued_at_ms'] <= now < value['expires_at_ms']:
        raise ValueError('EVIDENCE_EXPIRED')
    return value

def sign(value, key_env):
    key = os.environ.get(key_env, '')
    if len(key.encode()) < 32:
        raise ValueError('SIGNING_KEY_REQUIRED')
    payload = canonical(value)
    return {'payload': payload, 'signature': hmac.new(key.encode(), payload.encode(), hashlib.sha256).hexdigest()}

def scoped_file(root, relative):
    base = Path(root).resolve()
    target = (base / relative).resolve()
    if not target.is_relative_to(base) or not target.is_file():
        raise ValueError('ARTIFACT_PATH_INVALID')
    return target

