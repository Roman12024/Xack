import base64, hashlib, hmac, json, os, time, secrets

SECRET = os.environ.get("RTK_SECRET", "rtk-crm-dev-secret-change-me")
ITER = 100_000

def hash_password(pw, salt=None):
    salt = salt or secrets.token_hex(16)
    dk = hashlib.pbkdf2_hmac("sha256", pw.encode(), salt.encode(), ITER)
    return salt + "$" + dk.hex()

def verify_password(pw, stored):
    try:
        salt, hexhash = stored.split("$")
    except ValueError:
        return False
    dk = hashlib.pbkdf2_hmac("sha256", pw.encode(), salt.encode(), ITER)
    return hmac.compare_digest(dk.hex(), hexhash)

def _b64e(b):
    return base64.urlsafe_b64encode(b).rstrip(b"=").decode()

def _b64d(s):
    return base64.urlsafe_b64decode(s + "=" * (-len(s) % 4))

def make_token(user_id, username, role, ttl=3600 * 8, sid=None):
    payload = {"sub": user_id, "username": username, "role": role, "sid": sid,
               "exp": int(time.time()) + ttl}
    body = _b64e(json.dumps(payload).encode())
    sig = hmac.new(SECRET.encode(), body.encode(), hashlib.sha256).digest()
    return _b64e(b'{"alg":"HS256"}') + "." + body + "." + _b64e(sig)

def verify_token(token):
    try:
        header, body, sig = token.split(".")
        expect = hmac.new(SECRET.encode(), body.encode(), hashlib.sha256).digest()
        if not hmac.compare_digest(_b64e(expect), sig):
            return None
        payload = json.loads(_b64d(body))
        if payload.get("exp", 0) < time.time():
            return None
        return payload
    except Exception:
        return None
