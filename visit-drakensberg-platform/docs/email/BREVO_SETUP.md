# Marketing email via Brevo — setup, pilot and operations

Promotional campaigns are delivered through **Brevo**. Booking confirmations,
invoices, quotes, waivers and password resets keep using the SMTP mailbox
(`frontend/lib/mailer.ts`) and are **never** gated by marketing consent.

Real sending is **off by default**. A campaign can only leave the platform when
every setting in §3 is present *and* `MARKETING_SENDS_ENABLED=true`. Until then
the admin UI offers a dry run (counts the audience, delivers nothing).

---

## 1. How it fits together

```
Admin clicks Send ─▶ vd_campaign_enqueue()          one row per address in
                     (consent + suppression check)  vd_campaign_recipients
                              │
GitHub Actions (every 10 min) ▼
Vercel cron (daily backstop) ─▶ /api/cron/campaign-dispatch
                              │  claim batch (FOR UPDATE SKIP LOCKED)
                              │  re-check consent for each recipient
                              │  render per recipient (merge tags, signed
                              │  unsubscribe link, List-Unsubscribe headers)
                              ▼
                        Brevo  POST /v3/smtp/email
                              │
Brevo webhooks ─▶ /api/webhooks/brevo ─▶ vd_email_record_event()
   delivered / bounce / spam / opened / clicked / unsubscribed
   hard bounce + complaint ⇒ sticky suppression + consent withdrawn
```

* **Postgres is the source of truth** for who may be mailed. Brevo is only the
  delivery layer — don't maintain contact lists or segments in Brevo.
* The send is **resumable and idempotent**: state is per recipient, so a crash,
  a retried cron or two overlapping runs can never email anyone twice.
* **Audience** (`vd_marketing_audience`): marketing-consented accounts **plus**
  newsletter subscribers who have no account (latest consent-log decision is
  "yes"), minus suppressed addresses. Segment and hand-picked campaigns remain
  account-only, because segments are derived from account data.

## 2. Consent model (what changed and why)

| Flow | Now |
|---|---|
| Newsletter signup (home, hikes, …) | **Double opt-in.** Form → `/api/marketing/subscribe` stores a pending token and emails a link → `/subscribed` asks for one click → `/api/marketing/confirm` records consent. Nothing is subscribed on an unproven address. |
| Registration checkbox | Signed-in: opts the account in directly. No session yet: falls back to the double-opt-in email. |
| Unsubscribe link in a campaign | Carries a **signed token bound to that address**. One click on `/unsubscribe` confirms. Also sent as RFC 8058 `List-Unsubscribe` + `List-Unsubscribe-Post` headers (Gmail/Yahoo's native button). |
| `/unsubscribe` with no token | Types an address → we **email a signed link**. We never opt an address out on a typed address alone. |
| Hard bounce / spam complaint | Address suppressed permanently; complaints also withdraw consent. A fresh "yes" does **not** lift a suppression. |

Fixes shipped with it:

* `vd_set_consent()` no longer accepts **anonymous** calls (it let anyone
  subscribe anyone). `vd_is_subscribed()` is service-role only (it let anyone
  probe whether an address is on the list).
* Unsubscribing by email now clears `marketing_consent` on the **account**, not
  just the audit log. Previously an unsubscribed customer kept receiving
  campaigns.

## 3. Configuration

| Variable | Notes |
|---|---|
| `BREVO_API_KEY` | Brevo → SMTP & API → API keys. Server-side only. |
| `MARKETING_FROM_EMAIL` | A sender on the authenticated marketing subdomain, e.g. `hello@news.visitdrakensberg.com`. |
| `MARKETING_FROM_NAME` | Default `Visit Drakensberg`. |
| `MARKETING_REPLY_TO` | Optional monitored inbox. |
| `EMAIL_POSTAL_ADDRESS` | Printed in every footer. **Required** — sends refuse to start without it. |
| `MARKETING_TOKEN_SECRET` | 32+ random chars (`openssl rand -base64 48`). Don't rotate casually: it invalidates unsubscribe links already in inboxes. |
| `BREVO_WEBHOOK_SECRET` | Shared secret for the webhook (§5). |
| `MARKETING_SENDS_ENABLED` | Must be exactly `true`. The master switch. |
| `MARKETING_DAILY_CAP` | Default 300/day. Warm-up brake (§7). |
| `MARKETING_BATCH_SIZE` | Default 40 per dispatcher pass. |
| `CRON_SECRET` | Already exists; now **required** for sending (the dispatcher fails closed without it). |

The admin campaigns page shows exactly which of these are missing.

## 4. DNS and sender authentication

Send marketing mail from a **subdomain** (e.g. `news.visitdrakensberg.com`) so a
reputation problem there can't affect booking confirmations on the root domain.

In Brevo → **Senders, Domains & Dedicated IPs → Domains**, add the subdomain.
Brevo shows the records to publish — typically:

* **Brevo code** — a `TXT` record for ownership
* **DKIM** — `TXT` (or `CNAME`) records, e.g. `mail._domainkey.news`
* **SPF** — a `TXT` including Brevo's sender, on the subdomain
* **DMARC** — a `TXT` at `_dmarc.news` — start with `v=DMARC1; p=none; rua=mailto:<monitored inbox>`, tighten to `quarantine` after a few clean weeks

None of these need MX records, so the old limitation noted in `lib/mailer.ts`
(Wix DNS can't create subdomain MX records) does **not** block this. It does
need the DNS host to accept several TXT/CNAME records on a subdomain — if the
Wix zone refuses, moving the zone to Cloudflare (free) removes the problem.
Use the exact record names/values Brevo displays; they vary per account.

Then verify with: Brevo's "Authenticate" check turning green, and a test send
(§6) viewed with Gmail → ⋮ → *Show original* → SPF/DKIM/DMARC all **PASS**.

## 5. Webhook

Brevo → **Transactional → Settings → Webhook** (transactional, not marketing):

* **URL:** `https://visitdrakensberg.com/api/webhooks/brevo`
* **Authentication:** if the console offers a bearer token / `Authorization`
  header, use `BREVO_WEBHOOK_SECRET` as the token. Otherwise append it:
  `…/api/webhooks/brevo?secret=<BREVO_WEBHOOK_SECRET>`
* **Events:** Delivered, Hard bounce, Soft bounce, Blocked, Invalid email,
  Spam (complaint), Opened, Click, Unsubscribed, Deferred.

Events are idempotent (Brevo retries on any non-2xx; each event has a stable
key). Hard bounces, blocks, invalid addresses and spam complaints suppress the
address; complaints and provider-side unsubscribes also withdraw consent.

> ⚠️ **Verify in a Brevo sandbox before the pilot.** The Brevo integration was
> written against Brevo's documented v3 transactional API from memory — the
> build environment could not reach developers.brevo.com. Confirm in a real
> account: (1) `POST /v3/smtp/email` returns `messageId`; (2) the custom
> `headers` field passes `List-Unsubscribe` through (check *Show original*);
> (3) the webhook event names and `message-id` field match
> `lib/brevo-webhook.ts`; (4) which webhook auth option your console offers.
> Parsing is deliberately tolerant of spelling variants, but unverified.

## 6. Cron / dispatcher

`/api/cron/campaign-dispatch` starts due scheduled campaigns and delivers
queued recipients. Two triggers:

1. **GitHub Actions** — `.github/workflows/campaign-dispatch.yml`, every 10
   minutes. Set repository **variable** `SITE_URL` and **secret** `CRON_SECRET`.
   (Skips quietly until both exist. Runs only from the default branch.)
2. **Vercel cron** — daily at 06:00 UTC in `vercel.json`, as a backstop.
   Vercel Hobby rejects sub-daily crons, which is why the frequent one lives in
   GitHub Actions. On Vercel Pro you may move it to `*/10 * * * *` and drop the
   workflow.

Clicking **Send campaign** also delivers a first batch immediately.

## 7. Deploy order

1. Apply `supabase/migrations/20261007_marketing_send_pipeline.sql`
   (`scripts/migrate.sh`, or the SQL editor). It is safe with sending off.
2. Deploy the app. Signup forms switch to double opt-in and `/unsubscribe`
   switches to signed links immediately — this is useful even before Brevo.
3. Add the env vars (§3) but leave `MARKETING_SENDS_ENABLED=false`.
4. Authenticate the domain (§4), configure the webhook (§5), set up the cron (§6).
5. Run the pilot (§8). Only then set `MARKETING_SENDS_ENABLED=true` for real sends.

## 8. Pilot checklist

1. **Test send** (campaign page → *Send yourself a test*) to your own Gmail,
   Outlook and iCloud addresses. Check inbox vs spam, authentication PASS,
   rendering, the unsubscribe link, and that *Unsubscribe* in Gmail's header works.
2. **Staff-only campaign**: a hand-picked campaign to 5–10 staff who have opted
   in. Check Delivered/Opened show on the campaign page (webhook working).
3. **Bounce/unsubscribe round trip**: unsubscribe one test address, confirm it
   disappears from the audience count and is skipped on a second send.
4. **Small real send** to ~200 recently engaged subscribers.
5. Check rates (below) before widening.

**Warm-up** (the daily cap is the brake): ~300/day for the first week, then
double every few days while rates stay healthy. A new sending domain that
blasts its whole list on day one gets throttled or blocklisted.

**Health thresholds** — pause and investigate if exceeded: hard bounces > 2%,
spam complaints > 0.1%, unsubscribes > 0.5% on a send.

## 9. Operating notes

* **Pause / resume** a running send from the campaign page. Queued recipients
  stay queued. If the provider rejects the API key, the campaign auto-pauses
  with the reason shown and nothing further is attempted.
* **Opens are approximate** (Apple Mail Privacy Protection, scanners). Judge by
  clicks, replies and bookings. Tag campaign links with UTM parameters — the
  site already records UTMs on `vd_sessions` — to attribute bookings.
* **Un-suppressing** an address is deliberately not possible from the app. Use
  the service role in SQL, and only with the address owner's confirmation.
* **Daily cap** counts successful sends per UTC day across all campaigns.

## 10. Not done yet (next steps)

* **Wix import** with consent evidence. Treat imported lists as *unproven*: send
  a re-permission campaign before any promotion.
* **Directory contacts** (`/admin/contacts`) are cold B2B outreach with no
  consent column; they are intentionally **not** in any campaign audience.
* **Custom segment builder** — segments are still the eight code-defined ones.
* **Preference centre** (topics/frequency) — opt-out is all-or-nothing.
* **Server-side contact picker** — the builder still loads consented contacts
  into the browser; fine to a few thousand, move to server pagination beyond.
* **Automation flows** (welcome, pre-trip, post-trip, win-back).
* **Event-driven segment refresh** — segments still recompute nightly.
