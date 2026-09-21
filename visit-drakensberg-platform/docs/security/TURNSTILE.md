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

### Uploads: one challenge, then a grant

A Turnstile token is redeemable once, so a challenge per file would mean eight
of them for an applicant simply attaching pictures of their lodge. Instead:

1. The applicant solves **one** challenge on step 1 of the wizard.
2. `POST /api/listing-applications/upload-grant` trades it for a **two-hour,
   reference-scoped grant** — an HMAC in an httpOnly cookie
   (`lib/upload-grant.ts`). The key is derived from
   `SUPABASE_SERVICE_ROLE_KEY`, domain-separated, so there is no fourth secret
   to set correctly in three environments.
3. Each upload asks `POST /api/listing-applications/upload-url` for a signed
   URL for **one object at a path the server chooses**, then PUTs the bytes
   straight to Supabase Storage.
4. Certificates are registered through
   `POST /api/listing-applications/compliance-document`, which requires the
   same grant and refuses any `storage_path` outside `applications/<ref>/`.

The bytes never pass through a Vercel function — deliberately: the body limit
there is about 4.5 MB and these files run to 15 MB. What moved to the server is
the decision, not the payload.

If the grant lapses while the form is open, the upload comes back
`needsGrant: true`, and the form renews it from the step-1 widget and retries
once rather than making someone who has filled in four steps start again.

**Suppliers are untouched.** An approved supplier is signed in and writes only
into `suppliers/<their own uid>/…`, which `auth.uid()` pins exactly. RLS is
already the right control there.

### What this does not cover

Nothing outstanding on the applicant path. All four anonymous write endpoints
the 2026-08-07 and 2026-09-05 migrations opened are closed:

| Endpoint | Closed by |
|---|---|
| `vd_listing_applications` insert | `20260921_listing_applications_server_only.sql` |
| `media/listing-applications/…` | `20260921_applicant_uploads_server_only.sql` |
| `compliance/applications/…` | `20260921_applicant_uploads_server_only.sql` |
| `vd_compliance_documents` insert | `20260921_applicant_uploads_server_only.sql` |

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
| `frontend/lib/upload-grant.ts` | Signs and verifies the two-hour upload grant |
| `frontend/lib/listing-application-uploads.ts` | Server-chosen storage paths, MIME and size rules |
| `frontend/lib/applicant-upload.ts` | The browser half: grant, signed URL, PUT |
| `frontend/app/api/listing-applications/upload-grant/route.ts` | Captcha → grant |
| `frontend/app/api/listing-applications/upload-url/route.ts` | Grant → one signed upload URL |
| `frontend/app/api/listing-applications/compliance-document/route.ts` | Grant → one registry row |
| `frontend/supabase/migrations/20260921_…_server_only.sql` | Drops the four anonymous write policies |
| `frontend/tests/turnstile.test.ts` | The contract the forms depend on |
| `frontend/tests/turnstile-verify.test.ts` | Including the fail-closed behaviour |
| `frontend/tests/listing-application-intake.test.ts` | What the client no longer decides |
| `frontend/supabase/tests/listing_application_intake_test.sql` | That anon really cannot insert |

## Deploying the listing-application changes

Both `20260921_*_server_only.sql` migrations make the old client-side writes
fail. **Deploy the frontend first**, confirm a test application lands with a
photo and a certificate attached, and only then run them — a build that still
writes directly loses every application and every upload submitted in between.
