"""Security regression tests for app.core.security.

Covers the JWT half of audit finding M4. These import the module's real
functions against a stub settings object, so they exercise the shipped code
rather than a copy of it, and they need only python-jose and pytest — not a
database, Redis or the whole FastAPI app.

    pip install "python-jose[cryptography]==3.4.0" pytest
    pytest backend/tests/test_security.py
"""

from __future__ import annotations

import base64
import json
import sys
import types
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pytest
from jose import jwt

SECRET = "test-secret-not-a-real-key-0123456789"
SUPABASE_SECRET = "test-supabase-secret-0123456789abcdef"


def _install_stub_modules() -> None:
    """Stand in for app.core.config and app.core.database.

    Importing app.core.security for real would construct Settings (which reads
    a .env and raises without one) and open a Redis connection at import time.
    Neither is needed to test token handling.
    """
    if "app.core.security" in sys.modules:
        return

    # Real package paths, so app.core.security itself still loads from disk —
    # only config and database are replaced below.
    backend_root = Path(__file__).resolve().parent.parent
    if str(backend_root) not in sys.path:
        sys.path.insert(0, str(backend_root))

    for name, path in (("app", backend_root / "app"), ("app.core", backend_root / "app" / "core")):
        if name not in sys.modules:
            module = types.ModuleType(name)
            module.__path__ = [str(path)]  # type: ignore[attr-defined]
            sys.modules[name] = module

    config = types.ModuleType("app.core.config")
    config.settings = types.SimpleNamespace(  # type: ignore[attr-defined]
        SECRET_KEY=SECRET,
        ALGORITHM="HS256",
        ACCESS_TOKEN_EXPIRE_MINUTES=30,
        REFRESH_TOKEN_EXPIRE_DAYS=7,
        SUPABASE_JWT_SECRET=SUPABASE_SECRET,
        ENVIRONMENT="test",
    )
    sys.modules["app.core.config"] = config

    database = types.ModuleType("app.core.database")
    database.redis = types.SimpleNamespace(  # type: ignore[attr-defined]
        get=lambda *_: None, setex=lambda *_: None
    )
    database.get_db = lambda: None  # type: ignore[attr-defined]
    sys.modules["app.core.database"] = database


_install_stub_modules()

from app.core import security  # noqa: E402


# ── Token type confusion ────────────────────────────────────────────────────

def test_a_refresh_token_is_not_an_access_token():
    """The "type" claim is the only thing separating these; it must be checked."""
    refresh = security.create_refresh_token({"sub": "user-1", "role": "visitor"})
    with pytest.raises(Exception):
        security.verify_token(refresh, expected_type="access")


def test_a_password_reset_token_is_not_an_access_token():
    reset = security.create_password_reset_token("user-1")
    with pytest.raises(Exception):
        security.verify_token(reset, expected_type="access")


def test_an_email_verification_token_is_not_a_password_reset_token():
    verification = security.create_email_verification_token("user-1")
    with pytest.raises(Exception):
        security.verify_token(verification, expected_type="password_reset")


def test_each_token_verifies_as_its_own_type():
    access = security.create_access_token({"sub": "user-1", "role": "visitor"})
    assert security.verify_token(access, expected_type="access")["sub"] == "user-1"

    refresh = security.create_refresh_token({"sub": "user-1", "role": "visitor"})
    assert security.verify_token(refresh, expected_type="refresh")["sub"] == "user-1"


# ── Signature and algorithm ─────────────────────────────────────────────────

def test_a_token_signed_with_another_key_is_refused():
    forged = jwt.encode(
        {"sub": "user-1", "role": "admin", "type": "access",
         "exp": datetime.now(timezone.utc) + timedelta(minutes=30)},
        "a-different-secret-entirely",
        algorithm="HS256",
    )
    with pytest.raises(Exception):
        security.verify_token(forged)


def test_an_unsigned_token_is_refused():
    """alg=none is the oldest JWT attack there is.

    Hand-assembled rather than produced with jwt.encode: the library refuses
    to MINT an alg=none token, but an attacker assembles one with base64 and a
    text editor, so that is how the test builds it.
    """
    def segment(payload: dict) -> str:
        raw = json.dumps(payload, default=str).encode()
        return base64.urlsafe_b64encode(raw).rstrip(b"=").decode()

    header = segment({"alg": "none", "typ": "JWT"})
    claims = segment({
        "sub": "user-1", "role": "admin", "type": "access",
        "exp": int((datetime.now(timezone.utc) + timedelta(minutes=30)).timestamp()),
    })
    unsigned = f"{header}.{claims}."

    with pytest.raises(Exception):
        security.verify_token(unsigned)


def test_a_token_whose_header_claims_a_different_algorithm_is_refused():
    """verify_token pins algorithms=[HS256]; a header asserting anything else
    must not steer it."""
    def segment(payload: dict) -> str:
        raw = json.dumps(payload, default=str).encode()
        return base64.urlsafe_b64encode(raw).rstrip(b"=").decode()

    header = segment({"alg": "HS512", "typ": "JWT"})
    claims = segment({
        "sub": "user-1", "role": "admin", "type": "access",
        "exp": int((datetime.now(timezone.utc) + timedelta(minutes=30)).timestamp()),
    })
    with pytest.raises(Exception):
        security.verify_token(f"{header}.{claims}.signature")


def test_an_expired_token_is_refused():
    expired = jwt.encode(
        {"sub": "user-1", "type": "access",
         "exp": datetime.now(timezone.utc) - timedelta(minutes=1)},
        SECRET,
        algorithm="HS256",
    )
    with pytest.raises(Exception):
        security.verify_token(expired)


def test_garbage_is_refused_without_leaking_a_stack_trace():
    for value in ("", "not-a-token", "a.b.c", "Bearer x"):
        with pytest.raises(Exception):
            security.verify_token(value)


# ── Supabase tokens: the audience check (M4) ────────────────────────────────

def _supabase_token(audience: str) -> str:
    return jwt.encode(
        {"sub": "user-1", "aud": audience, "role": audience,
         "exp": datetime.now(timezone.utc) + timedelta(hours=1)},
        SUPABASE_SECRET,
        algorithm="HS256",
    )


def test_a_signed_in_users_supabase_token_is_accepted():
    assert security.verify_supabase_jwt(_supabase_token("authenticated"))["sub"] == "user-1"


@pytest.mark.parametrize("audience", ["anon", "service_role", "someone-else"])
def test_a_token_for_another_audience_is_refused(audience):
    """M4: verify_aud was disabled, so any token minted on the same project
    secret — including the anon token published to every browser — was accepted
    here as a signed-in user."""
    with pytest.raises(Exception):
        security.verify_supabase_jwt(_supabase_token(audience))


def test_a_supabase_token_signed_with_our_own_secret_is_refused():
    """The two secrets are different keys and must not be interchangeable."""
    wrong_key = jwt.encode(
        {"sub": "user-1", "aud": "authenticated",
         "exp": datetime.now(timezone.utc) + timedelta(hours=1)},
        SECRET,
        algorithm="HS256",
    )
    with pytest.raises(Exception):
        security.verify_supabase_jwt(wrong_key)


def test_the_rejection_message_does_not_echo_the_token():
    """The detail used to be f-string interpolated from the jose exception,
    which can carry claim values back to an unauthenticated caller."""
    with pytest.raises(Exception) as excinfo:
        security.verify_supabase_jwt(_supabase_token("anon"))
    assert "anon" not in str(getattr(excinfo.value, "detail", ""))


# ── Password hashing ────────────────────────────────────────────────────────

def test_passwords_are_hashed_not_stored():
    hashed = security.get_password_hash("correct horse battery staple")
    assert hashed != "correct horse battery staple"
    assert hashed.startswith("$2")  # bcrypt
    assert security.verify_password("correct horse battery staple", hashed)
    assert not security.verify_password("wrong password", hashed)


def test_the_same_password_hashes_differently_each_time():
    """A per-hash salt: two accounts with the same password must not be
    identifiable from the hashes alone."""
    a = security.get_password_hash("same password")
    b = security.get_password_hash("same password")
    assert a != b
