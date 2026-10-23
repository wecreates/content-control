"""Shared strict IO and signed evidence helpers; Python 3.12 compatible."""
import hashlib
import hmac
import json
import math
import os
import stat
import time
from pathlib import Path

PLATFORMS = {'kdp', 'redbubble', 'teepublic', 'zazzle', 'spreadshirt'}
MAX_JSON_BYTES = 4 * 1024 * 1024

def strict_json(text):
    """Reject duplicate decoded keys and nonfinite numbers at every depth."""
    def pairs(values):
        result = {}
        for key, value in values:
            if key in result:
                raise ValueError('JSON_DUPLICATE_KEY')
            result[key] = value
        return result

    def number(token):
        value = float(token)
        if not math.isfinite(value):
            raise ValueError('JSON_NONFINITE')
        return value

    def integer(token):
        value = int(token)
        try:
            finite = math.isfinite(value)
        except OverflowError:
            finite = False
        if not finite:
            raise ValueError('JSON_NONFINITE')
        return value

    def invalid(_token):
        raise ValueError('JSON_NONFINITE')

    return json.loads(text, object_pairs_hook=pairs, parse_float=number,
                      parse_int=integer, parse_constant=invalid)

def canonical(value):
    return json.dumps(value, sort_keys=True, separators=(',', ':'), ensure_ascii=False, allow_nan=False)

MAX_DIGEST_BYTES = 16 * 1024 * 1024  # Existing POD artifact object ceiling.

def open_regular_binary(path, reason='BINARY_FILE_INVALID'):
    # Check the opened object: path checks alone race replacement. Never wait
    # for a FIFO writer or follow a substituted final symlink before validation.
    fd = os.open(path, os.O_RDONLY | os.O_NONBLOCK | os.O_NOFOLLOW)
    try:
        if not stat.S_ISREG(os.fstat(fd).st_mode):
            raise ValueError(reason)
        return os.fdopen(fd, 'rb')
    except BaseException:
        os.close(fd)
        raise

def digest(path):
    h = hashlib.sha256()
    total = 0
    with open_regular_binary(path) as source:
        while True:
            chunk = source.read(min(1024 * 1024, MAX_DIGEST_BYTES - total + 1))
            if not chunk:
                break
            total += len(chunk)
            if total > MAX_DIGEST_BYTES:
                raise ValueError('DIGEST_TOO_LARGE')
            h.update(chunk)
    return h.hexdigest()

def read_json(path):
    # Bound actual captured bytes even if the file grows after opening.
    source = open_regular_binary(path, 'JSON_FILE_INVALID')
    with source:
        data = source.read(MAX_JSON_BYTES + 1)
    if len(data) > MAX_JSON_BYTES:
        raise ValueError('JSON_TOO_LARGE')
    return strict_json(data.decode('utf-8', errors='strict'))

def save_json(path, value):
    p = Path(path)
    p.parent.mkdir(parents=True, exist_ok=True)
    temp = p.with_name(p.name + '.tmp-' + os.urandom(6).hex())
    fd = None
    try:
        flags = os.O_WRONLY | os.O_CREAT | os.O_EXCL
        if hasattr(os, 'O_NOFOLLOW'):
            flags |= os.O_NOFOLLOW
        fd = os.open(temp, flags, 0o600)
        with os.fdopen(fd, 'w', encoding='utf-8') as f:
            fd = None
            f.write(canonical(value) + '\n')
            f.flush()
            os.fsync(f.fileno())
        os.replace(temp, p)
    finally:
        if fd is not None:
            os.close(fd)
        temp.unlink(missing_ok=True)

def verified(envelope, key_env, audience):
    key = os.environ.get(key_env, '')
    if len(key.encode()) < 32:
        raise ValueError('EVIDENCE_KEY_REQUIRED')
    if not isinstance(envelope, dict):
        raise ValueError('EVIDENCE_INVALID')
    payload = envelope.get('payload')
    supplied = envelope.get('signature')
    if (type(payload) is not str or len(payload) > MAX_JSON_BYTES
            or type(supplied) is not str or len(supplied) != 64
            or any(c not in '0123456789abcdef' for c in supplied)):
        raise ValueError('EVIDENCE_INVALID')
    try:
        encoded = payload.encode('utf-8', errors='strict')
    except UnicodeEncodeError:
        raise ValueError('EVIDENCE_INVALID') from None
    if len(encoded) > MAX_JSON_BYTES:
        raise ValueError('EVIDENCE_INVALID')
    signature = hmac.new(key.encode(), encoded, hashlib.sha256).hexdigest()
    if not hmac.compare_digest(signature, supplied):
        raise ValueError('EVIDENCE_SIGNATURE_INVALID')
    value = strict_json(payload)
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

