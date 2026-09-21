# Backend security tests

Regression tests for the backend half of the September 2026 security audit
(`docs/security/SECURITY_AUDIT_2026-09.md`, finding M4).

```bash
python -m venv .venv && . .venv/bin/activate
pip install -r requirements.txt pytest
pytest tests/ -q
```

`test_security.py` needs only what `app.core.security` itself imports —
fastapi, sqlalchemy, python-jose, passlib and pytest — not the full
`requirements.txt` (no asyncpg, no Supabase client, no resend). It stubs `app.core.config` and
`app.core.database` (which would otherwise construct `Settings` from a missing
`.env` and open a Redis connection at import time) while leaving the real
`app.core.security` to load from disk, so the tests exercise the shipped code
rather than a copy of it.

## Prove a test catches its finding

Before committing a regression test, revert the fix and watch it fail. For the
audience check, that means putting `options={"verify_aud": False}` back in
`verify_supabase_jwt` and running:

```bash
pytest tests/test_security.py -q -k audience   # must FAIL
```
