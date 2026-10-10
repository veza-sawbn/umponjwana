import { describe, it, expect, vi } from 'vitest'
import { dispatchCampaigns } from '@/lib/campaign-dispatch'
import { getMarketingConfig } from '@/lib/marketing-config'

// A fake of the slice of the Supabase client the dispatcher uses. State lives
// in `db` so assertions can look at what the worker recorded.
function fakeAdmin(opts: { recipients: { id: string; email: string; user_id: string | null }[]; sentToday?: number }) {
  const db = {
    queue: opts.recipients.map(r => ({ ...r, campaign_id: 'c1', attempts: 0, status: 'queued' as string })),
    marks: [] as any[], halts: [] as any[], finalized: 0, released: [] as string[],
  }
  const tables: Record<string, any> = {
    vd_email_campaigns: { data: [{ id: 'c1', name: 'Winter', merge_values: { offer: 'Winter midweek' }, template_id: 't1' }] },
    vd_email_templates: { data: [{ id: 't1', subject: 'Hi {{first_name|there}}', preheader: '', html_body: '<p>{{offer}}</p>', hero_image_url: null, hero_image_alt: null }] },
    profiles: { data: [] }, vd_customer_profiles: { data: [] }, vd_orders: { data: [] },
  }
  const chain = (table: string) => {
    const api: any = {
      select: () => api, in: () => api, neq: () => api, eq: () => api, gte: () => api, update: () => api,
      maybeSingle: async () => ({ data: { attempts: 1 } }),
      then: (res: any) => {
        if (table === 'vd_campaign_recipients') {
          // count query for the daily cap
          return res({ count: opts.sentToday ?? 0, error: null })
        }
        return res({ data: tables[table]?.data ?? [], error: null })
      },
    }
    return api
  }
  const admin: any = {
    from: (t: string) => chain(t),
    rpc: async (fn: string, args: any) => {
      switch (fn) {
        case 'vd_campaign_activate_due': return { data: 0, error: null }
        case 'vd_campaign_claim_batch': {
          const take = db.queue.filter(r => r.status === 'queued').slice(0, args.p_limit)
          take.forEach(r => { r.status = 'sending'; r.attempts += 1 })
          return { data: take.map(r => ({ recipient_id: r.id, campaign_id: r.campaign_id, email: r.email, user_id: r.user_id, attempts: r.attempts })), error: null }
        }
        case 'vd_campaign_mark_recipient': {
          db.marks.push(args)
          const r = db.queue.find(x => x.id === args.p_recipient_id)!
          r.status = args.p_ok ? 'sent' : args.p_retryable ? 'queued' : 'failed'
          return { data: null, error: null }
        }
        case 'vd_campaign_halt': db.halts.push(args); return { data: null, error: null }
        case 'vd_campaign_finalize': db.finalized += 1; return { data: 0, error: null }
        default: throw new Error(`unexpected rpc ${fn}`)
      }
    },
  }
  return { admin, db }
}

const cfg = getMarketingConfig({
  BREVO_API_KEY: 'k', MARKETING_FROM_EMAIL: 'hello@news.example.com', EMAIL_POSTAL_ADDRESS: '1 Berg Rd',
  MARKETING_TOKEN_SECRET: 'x'.repeat(40), BREVO_WEBHOOK_SECRET: 'w', MARKETING_SENDS_ENABLED: 'true',
  MARKETING_DAILY_CAP: '100', MARKETING_BATCH_SIZE: '10',
} as unknown as NodeJS.ProcessEnv)

const people = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `r${i}`, email: `p${i}@example.com`, user_id: null }))
const ok = () => vi.fn(async () => new Response(JSON.stringify({ messageId: '<m@x>' }), { status: 201 })) as unknown as typeof fetch

describe('dispatchCampaigns', () => {
  it('does nothing — and says why — when sending is not configured', async () => {
    const { admin } = fakeAdmin({ recipients: people(2) })
    const s = await dispatchCampaigns({ origin: 'https://x.co', budgetMs: 5000, admin, fetchImpl: ok(), cfg: getMarketingConfig({} as NodeJS.ProcessEnv) })
    expect(s.skipped?.length).toBeGreaterThan(0)
    expect(s.sent).toBe(0)
  })

  it('sends every queued recipient once and finalizes', async () => {
    const { admin, db } = fakeAdmin({ recipients: people(25) })
    const f = ok()
    const s = await dispatchCampaigns({ origin: 'https://x.co', budgetMs: 5000, admin, fetchImpl: f, cfg })
    expect(s.sent).toBe(25)
    expect((f as any).mock.calls).toHaveLength(25)
    expect(db.marks.filter(m => m.p_ok)).toHaveLength(25)
    expect(db.queue.every(r => r.status === 'sent')).toBe(true)
    expect(db.finalized).toBe(1)
  })

  it('personalises per recipient and sends the one-click unsubscribe headers', async () => {
    const { admin } = fakeAdmin({ recipients: people(1) })
    const f = ok()
    await dispatchCampaigns({ origin: 'https://x.co', budgetMs: 5000, admin, fetchImpl: f, cfg })
    const body = JSON.parse((f as any).mock.calls[0][1].body)
    expect(body.to[0].email).toBe('p0@example.com')
    expect(body.subject).toBe('Hi there')
    expect(body.htmlContent).toContain('Winter midweek')
    expect(body.headers['List-Unsubscribe-Post']).toBe('List-Unsubscribe=One-Click')
  })

  it('sends nothing once the daily cap is spent, leaving the queue for tomorrow', async () => {
    const { admin, db } = fakeAdmin({ recipients: people(5), sentToday: 100 })
    const f = ok()
    const s = await dispatchCampaigns({ origin: 'https://x.co', budgetMs: 5000, admin, fetchImpl: f, cfg })
    expect(s.dailyCapReached).toBe(true)
    expect(s.sent).toBe(0)
    expect((f as any).mock.calls).toHaveLength(0)
    expect(db.queue.every(r => r.status === 'queued')).toBe(true)
  })

  it('a rejected API key halts the campaign and stops immediately, without burning the rest of the list', async () => {
    const { admin, db } = fakeAdmin({ recipients: people(20) })
    const f = vi.fn(async () => new Response(JSON.stringify({ code: 'unauthorized', message: 'Key not found' }), { status: 401 })) as unknown as typeof fetch
    const s = await dispatchCampaigns({ origin: 'https://x.co', budgetMs: 5000, admin, fetchImpl: f, cfg })
    expect((f as any).mock.calls).toHaveLength(1)
    expect(db.halts).toHaveLength(1)
    expect(s.haltedReason).toContain('401')
    expect(s.sent).toBe(0)
  })

  it('throttling requeues the recipient and ends the run', async () => {
    const { admin, db } = fakeAdmin({ recipients: people(10) })
    const f = vi.fn(async () => new Response('{}', { status: 429 })) as unknown as typeof fetch
    const s = await dispatchCampaigns({ origin: 'https://x.co', budgetMs: 5000, admin, fetchImpl: f, cfg })
    expect((f as any).mock.calls).toHaveLength(1)
    expect(db.marks[0]).toMatchObject({ p_ok: false, p_retryable: true })
    expect(s.sent).toBe(0)
  })

  it('a recipient the provider rejects fails alone and the run continues', async () => {
    const { admin, db } = fakeAdmin({ recipients: people(3) })
    let n = 0
    const f = vi.fn(async () => {
      n += 1
      return n === 2
        ? new Response(JSON.stringify({ code: 'invalid_parameter', message: 'bad address' }), { status: 400 })
        : new Response(JSON.stringify({ messageId: '<m@x>' }), { status: 201 })
    }) as unknown as typeof fetch
    const s = await dispatchCampaigns({ origin: 'https://x.co', budgetMs: 5000, admin, fetchImpl: f, cfg })
    expect(s.sent).toBe(2)
    expect(s.failed).toBe(1)
    expect(db.queue.filter(r => r.status === 'failed')).toHaveLength(1)
  })
})
