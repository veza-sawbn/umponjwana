# Cloudflare Turnstile

Bot protection for sign-in, registration, password reset and the "list with
us" application.

## Why

On 2026-09-20 the listing-application form had taken **144 submissions, 109 of
them scripted** — a single run against an unauthenticated write endpoint that
`20260807_listing_applications.sql` had warned about in its own header a month
earlier:

> It is still an unauthenticated write endpoint: a bot that finds it can fill
> the bucket. Put the platform behind a rate limit / captcha before this sees
> real traffic.

It saw real traffic first. This is the captcha.

## Where the check happens — and where it can't

`frontend/lib/auth.ts` uses `createClientComponentClient`, so **the browser
talks to `*.supabase.co` directly**. No Vercel function, no middleware and no
WAF sits between a visitor and a signup. That single architectural fact decides
the whole design:

| Entry point | Who enforces the token | How |
|---|---|---|
| `signInWithPassword` (`/auth/login`) | **Supabase** | Attack Protection setting |
| `signUp` (`/auth/register`) | **Supabase** | Attack Protection setting |
| `signUp` (`/list-with-us`, step 5) | **Supabase** | Attack Protection setting |
| `POST /api/auth/request-password-reset` | **This repo** | `lib/turnstile-verify.ts` |
| `POST /api/listing-applications` | **This repo** | `lib/turnstile-verify.ts` |

The last two rows are the reason `TURNSTILE_SECRET_KEY` exists in the app's own
environment at all. Both routes hold the **service-role** key, and GoTrue
exempts service-role calls from captcha by design, so nothing in the Supabase
dashboard will ever protect them; they verify the token themselves against
`siteverify`.

### The wizard spends two tokens

A token is redeemable **once**. `/list-with-us` needs two in a row: Supabase
redeems the first on `signUp`, and `POST /api/listing-applications` needs an
unspent one. So `submit()` calls `turnstile.refresh()` between the two steps,
which resets the widget and resolves with the next token. A managed widget
re-solves without interaction, so this normally settles in under a second; if
Cloudflare decides the visitor must click something, `refresh()` rejects on a
15-second timeout rather than hanging the submit, and the applicant is asked to
complete the check and press Submit again with the form still filled in.

The widget is shown whether or not the applicant is signed in. Signing in
skips the `signUp` but not the route.

### What is *not* gated, and why that is fine

`verifyOtp({ token_hash, type })` on `/auth/reset-password` — the page a
recovery email links to. GoTrue does not apply the captcha to that shape, and
`@supabase/auth-js` agrees: `VerifyTokenHashParams` is the one auth parameter
type in the library with **no** `captchaToken` field, so there would be no way
to satisfy a check there. Recovery links keep working after the switch is
flipped. (It is also not a useful target: the token arrives in an email we
sent, and getting one sent now requires passing the captcha on
`/auth/forgot-password`.)

### What this does not cover

The anonymous storage `INSERT` into `media/listing-applications/…`, opened by
the same 2026-08-07 migration and covered by the same warning. Photos are
uploaded while the applicant is still filling the form, so closing it means
routing uploads through a server route that verifies a token — a larger change
than the application write, and the bucket's own limits (50 MB per object, an
allowed-MIME list, and `20260913_media_bucket_no_active_content.sql`) still
apply. **Open item** — tracked in `SECURITY_AUDIT_2026-09.md` under follow-up
work.

The direct `insert` into `vd_listing_applications` **was** the other half of
this and is now closed: the table no longer accepts anonymous inserts at all
(`20260921_listing_applications_server_only.sql`), so the route is the only
way in and its captcha is not skippable.

## Configuration

Two keys, from Cloudflare dashboard → Turnstile → your widget.

| Key | Where it goes | Secret? |
|---|---|---|
| Site key (`0x4AAAAAAE-…`) | Vercel → `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | No — it ships in the page source |
| Secret key | Supabase → Attack Protection **and** Vercel → `TURNSTILE_SECRET_KEY` | **Yes** |

The secret key must never appear in this repository, in a commit, or behind a
`NEXT_PUBLIC_` prefix.

The widget's **Hostname Management** list in the Cloudflare dashboard must
include every host the widget renders on. For preview deploys that means
adding the Vercel preview domain, or the widget refuses to render there.

## Turning it on — the order matters

Supabase's captcha setting rejects every signup and sign-in that arrives
without a token, and it applies the instant it is saved. Do this in order or
the site locks everyone out, including you.

1. **Vercel → Environment Variables**: set `NEXT_PUBLIC_TURNSTILE_SITE_KEY`
   and `TURNSTILE_SECRET_KEY` on Production. **Redeploy** — `NEXT_PUBLIC_*` is
   inlined at build time, so an existing deployment will not pick it up.
2. **Verify nothing has changed for visitors yet.** Open `/auth/login` in a
   private window: the widget should render and sign-in should still work.
   Tokens are now travelling; nobody is checking them.
3. **Supabase → Authentication → Attack Protection** → Enable Captcha
   protection → provider **Turnstile** → paste the **secret** key → Save.
4. **Test immediately, in a private window**: sign in, register a throwaway
   account, request a password reset, and submit a listing application. All
   four must work.

### Rollback

Switch the Supabase setting off. Tokens keep being sent and nothing checks
them; the site works. The widget is harmless on its own, so there is no need to
revert a deploy or remove an environment variable under pressure.

If the app's own `TURNSTILE_SECRET_KEY` is the problem (password resets
failing while everything else works), unset it and redeploy — that route falls
back to `not_configured` and skips the check.

## How it behaves

- **No site key configured** — the widget renders nothing and every form
  submits without a token. This is what local development and preview builds
  get, on purpose: a checkout nobody can sign into is a checkout nobody can
  test. It is *not* a safe production state once step 3 above is done.
- **Tokens are single-use and live ~300 s.** Every form resets the widget in
  its `catch` block, because Supabase redeems the token *before* it looks at
  the email — so "that address is already registered" burns the token, and the
  retry the message asks for would otherwise fail for a completely unrelated
  reason.
- **`siteverify` fails closed.** An unreachable Cloudflare refuses the password
  reset rather than waving it through; same posture `lib/rate-limit.ts` takes
  on that route, for the same reason.

## Content-Security-Policy

`frontend/security-headers.mjs` allows `https://challenges.cloudflare.com` in
**three** directives — `script-src`, `frame-src` and `connect-src`. Dropping
any one of them does not fail a build; it makes the captcha silently fail to
appear the day the Report-Only policy is promoted to enforcing, which with
step 3 done locks every visitor out. `tests/security-headers.test.ts` asserts
all three.

## Files

| File | What it does |
|---|---|
| `frontend/lib/turnstile.ts` | Site key, script URL, `captchaOptions()`, `isTurnstileEnabled()` |
| `frontend/lib/turnstile-verify.ts` | Server-side `siteverify`, fail-closed |
| `frontend/components/security/Turnstile.tsx` | The widget: explicit render, `reset()` and `refresh()` |
| `frontend/app/api/listing-applications/route.ts` | The only way into `vd_listing_applications` |
| `frontend/lib/listing-application-intake.ts` | Server-owned id/status/timestamp, size ceiling |
| `frontend/supabase/migrations/20260921_…_server_only.sql` | Drops the anonymous insert policy |
| `frontend/tests/turnstile.test.ts` | The contract the forms depend on |
| `frontend/tests/turnstile-verify.test.ts` | Including the fail-closed behaviour |
| `frontend/tests/listing-application-intake.test.ts` | What the client no longer decides |
| `frontend/supabase/tests/listing_application_intake_test.sql` | That anon really cannot insert |

## Deploying the listing-application change

`20260921_listing_applications_server_only.sql` makes the old client-side
insert fail. **Deploy the frontend first**, confirm a test application lands,
and only then run the migration — a build that still performs the direct
insert loses every application submitted in between.
