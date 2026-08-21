import { supabase } from './auth'

/* ────────────────────────────────────────────────────────────────────────────
 * Customer Intelligence — first-party event tracking (client).
 *
 * The single trackEvent() entry point described in the CRM/analytics handoff
 * (§21): every behavioural signal — pageviews, catalogue views, search,
 * favourites, booking-funnel steps — flows through here into
 * `vd_analytics_events`, so analytics, CRM, automation and marketing
 * attribution all read one stream instead of five separate ones.
 *
 * Writes go through the vd_touch_session()/vd_track_event() Postgres
 * functions (see supabase/migrations/20260824_customer_intelligence_foundation.sql)
 * rather than a direct table insert — user_id is set server-side from the
 * caller's JWT, so a client can never spoof another visitor's identity.
 *
 * SERVER NOTE: this module is browser-only (localStorage/sessionStorage,
 * navigator, document.referrer). Do not import it from a Server Component or
 * a route handler — every export below no-ops outside the browser instead of
 * throwing, so an accidental server-side call is silent rather than fatal.
 * ──────────────────────────────────────────────────────────────────────────── */

const ANON_ID_KEY = 'vd_anon_id'
const SESSION_ID_KEY = 'vd_session_id'
const SESSION_LAST_ACTIVE_KEY = 'vd_session_last_active'
const SESSION_IDLE_TIMEOUT_MS = 30 * 60 * 1000

/** Well-known event names from the handoff's taxonomy (§3). The event system
 *  is intentionally extensible — trackEvent() accepts any string — these are
 *  just the ones other code should reuse rather than re-typing by hand. */
export const AnalyticsEvent = {
  PAGE_VIEW: 'page_view',
  DESTINATION_VIEW: 'destination_view',
  REGION_VIEW: 'region_view',
  TRAIL_VIEW: 'trail_view',
  ACTIVITY_VIEW: 'activity_view',
  ACCOMMODATION_VIEW: 'accommodation_view',
  SUPPLIER_VIEW: 'supplier_view',
  SEARCH_PERFORMED: 'search_performed',
  FILTER_USED: 'filter_used',
  MAP_INTERACTION: 'map_interaction',
  FAVOURITE_ADDED: 'favourite_added',
  FAVOURITE_REMOVED: 'favourite_removed',
  SHARE_CLICKED: 'share_clicked',
  GUIDE_PROFILE_VIEWED: 'guide_profile_viewed',
  BOOKING_STARTED: 'booking_started',
  BOOKING_STEP_COMPLETED: 'booking_step_completed',
  BOOKING_ABANDONED: 'booking_abandoned',
  BOOKING_COMPLETED: 'booking_completed',
  ACCOUNT_CREATED: 'account_created',
  LOGIN: 'login',
  NEWSLETTER_SIGNUP: 'newsletter_signup',
  EMAIL_OPENED: 'email_opened',
  EMAIL_CLICKED: 'email_clicked',
} as const

function uuid(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  // Fallback for older browsers without crypto.randomUUID.
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

function getAnonId(): string {
  if (typeof window === 'undefined') return 'server'
  let id = localStorage.getItem(ANON_ID_KEY)
  if (!id) {
    id = uuid()
    localStorage.setItem(ANON_ID_KEY, id)
  }
  return id
}

function detectDeviceType(): string {
  if (typeof navigator === 'undefined') return 'unknown'
  const ua = navigator.userAgent
  if (/ipad|tablet/i.test(ua)) return 'tablet'
  if (/mobile|iphone|android/i.test(ua)) return 'mobile'
  return 'desktop'
}

function detectBrowser(): string {
  if (typeof navigator === 'undefined') return 'unknown'
  const ua = navigator.userAgent
  if (/edg\//i.test(ua)) return 'edge'
  if (/chrome|crios/i.test(ua)) return 'chrome'
  if (/firefox/i.test(ua)) return 'firefox'
  if (/safari/i.test(ua) && !/chrome|crios/i.test(ua)) return 'safari'
  return 'other'
}

let sessionReady: Promise<string> | null = null

/**
 * Returns the current session id, creating one (and capturing first-touch
 * landing page / referrer / UTM parameters) the first time it's called, or
 * after SESSION_IDLE_TIMEOUT_MS of inactivity. The freshness check runs on
 * every call — `sessionReady` only dedupes calls that race while a *new*
 * session is actually being created, and is cleared as soon as that
 * settles, so a later idle check isn't permanently shadowed by the first
 * call's cached promise (which would otherwise pin the whole tab to one
 * session for its entire lifetime, corrupting session counts/durations for
 * any visit longer than the idle window).
 */
function ensureSession(): Promise<string> {
  if (typeof window === 'undefined') return Promise.resolve('server')

  const now = Date.now()
  const existingId = localStorage.getItem(SESSION_ID_KEY)
  const lastActive = Number(sessionStorage.getItem(SESSION_LAST_ACTIVE_KEY) || 0)
  const idle = !lastActive || now - lastActive > SESSION_IDLE_TIMEOUT_MS

  if (existingId && !idle) {
    sessionStorage.setItem(SESSION_LAST_ACTIVE_KEY, String(now))
    return Promise.resolve(existingId)
  }

  if (sessionReady) return sessionReady

  sessionReady = (async () => {
    const params = new URLSearchParams(window.location.search)
    try {
      const { data, error } = await supabase.rpc('vd_touch_session', {
        p_session_id: null,
        p_anon_id: getAnonId(),
        p_landing_page: window.location.pathname,
        p_referrer: document.referrer || null,
        p_utm_source: params.get('utm_source'),
        p_utm_medium: params.get('utm_medium'),
        p_utm_campaign: params.get('utm_campaign'),
        p_utm_content: params.get('utm_content'),
        p_utm_term: params.get('utm_term'),
        p_device_type: detectDeviceType(),
        p_browser: detectBrowser(),
      })
      if (error || !data) throw error || new Error('no session id returned')
      localStorage.setItem(SESSION_ID_KEY, data as string)
      sessionStorage.setItem(SESSION_LAST_ACTIVE_KEY, String(now))
      return data as string
    } catch (e) {
      console.error('[analytics] session init failed:', e)
      return existingId || ''
    } finally {
      sessionReady = null
    }
  })()

  return sessionReady
}

/** Central event tracker — see the module docblock. Safe to call from any
 *  client component; failures are logged, never thrown, so a tracking hiccup
 *  can't break the page it's called from. */
export async function trackEvent(
  eventName: string,
  properties: Record<string, unknown> = {},
  pageUrl?: string,
): Promise<void> {
  if (typeof window === 'undefined') return
  try {
    const sessionId = await ensureSession()
    const { error } = await supabase.rpc('vd_track_event', {
      p_session_id: sessionId || null,
      p_anon_id: getAnonId(),
      p_event_name: eventName,
      p_properties: properties,
      p_page_url: pageUrl ?? window.location.pathname,
    })
    if (error) console.error('[analytics] track failed:', eventName, error)
  } catch (e) {
    console.error('[analytics] track threw:', eventName, e)
  }
}

export function trackPageView(pathname: string): Promise<void> {
  return trackEvent(AnalyticsEvent.PAGE_VIEW, {}, pathname)
}
