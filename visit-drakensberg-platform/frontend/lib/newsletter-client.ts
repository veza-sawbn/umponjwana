// Client helper for the double-opt-in signup. Nothing is subscribed by this
// call — it asks the server to email a confirmation link (see
// app/api/marketing/subscribe). Consent is recorded only when that link is
// confirmed.
export async function requestNewsletterOptIn(
  email: string,
  source: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const res = await fetch('/api/marketing/subscribe', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, source }),
    })
    if (res.ok) return { ok: true }
    const data = await res.json().catch(() => ({}))
    return { ok: false, error: data?.error || 'Subscription failed. Please try again later.' }
  } catch {
    return { ok: false, error: 'Subscription failed. Please try again later.' }
  }
}
