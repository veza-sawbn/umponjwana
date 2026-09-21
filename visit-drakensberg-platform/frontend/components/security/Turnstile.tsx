'use client'

import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'
import {
  TURNSTILE_HOST,
  TURNSTILE_SITE_KEY,
  isTurnstileEnabled,
} from '@/lib/turnstile'

/**
 * Cloudflare Turnstile widget.
 *
 * Rendered explicitly rather than by the script's DOM scan, because two of the
 * three forms it guards are not on screen when the page loads: the list-with-us
 * widget lives on the last step of a five-step wizard, and every form remounts
 * it after a failed submit.
 *
 * TOKENS ARE SINGLE-USE
 *   A token is redeemable once and lives about five minutes. That makes the
 *   reset path load-bearing, not a nicety: if a signup is refused for any
 *   reason — a duplicate email, a network blip — the token is gone, and
 *   submitting again without a fresh one fails with an opaque captcha error
 *   that has nothing to do with what the person typed. So every caller resets
 *   in its catch block, and the widget clears the parent's token whenever it
 *   expires, times out or errors.
 *
 * UNCONFIGURED IS A WORKING STATE
 *   With no NEXT_PUBLIC_TURNSTILE_SITE_KEY this renders nothing at all and the
 *   forms submit without a token, which is what local development and preview
 *   builds need. Callers gate their "solve the captcha first" requirement on
 *   isTurnstileEnabled() for the same reason.
 */

type TurnstileOptions = {
  sitekey: string
  action?: string
  theme?: 'light' | 'dark' | 'auto'
  appearance?: 'always' | 'execute' | 'interaction-only'
  callback?: (token: string) => void
  'error-callback'?: (code?: string) => void
  'expired-callback'?: () => void
  'timeout-callback'?: () => void
}

type TurnstileApi = {
  render: (el: HTMLElement | string, options: TurnstileOptions) => string
  reset: (widgetId?: string) => void
  remove: (widgetId?: string) => void
}

declare global {
  interface Window {
    turnstile?: TurnstileApi
    __vdTurnstileOnload?: () => void
  }
}

/** One script tag per document, however many widgets ask for it. */
let scriptPromise: Promise<void> | null = null

function loadTurnstileScript(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve()
  if (window.turnstile) return Promise.resolve()
  if (scriptPromise) return scriptPromise

  scriptPromise = new Promise<void>((resolve, reject) => {
    // The onload callback is how Cloudflare signals that window.turnstile is
    // populated; waiting on the script's own load event can win the race in
    // some browsers and lose it in others.
    window.__vdTurnstileOnload = () => resolve()
    const script = document.createElement('script')
    script.src = `${TURNSTILE_HOST}/turnstile/v0/api.js?render=explicit&onload=__vdTurnstileOnload`
    script.async = true
    script.defer = true
    script.onerror = () => {
      // Let a later mount try again — this is usually a blocked request or a
      // dropped connection, not a permanent state.
      scriptPromise = null
      reject(new Error('Turnstile script failed to load'))
    }
    document.head.appendChild(script)
  })

  return scriptPromise
}

export type TurnstileHandle = {
  /** Discard the spent/failed token and ask the widget for a new one. */
  reset: () => void
}

export type TurnstileProps = {
  /** Labels the challenge in Cloudflare's analytics, e.g. 'login', 'signup'. */
  action: string
  /** Called with a fresh token, and with '' whenever the current one dies. */
  onToken: (token: string) => void
  /** Called when the widget or its script fails, for a human-readable message. */
  onError?: () => void
  theme?: 'light' | 'dark' | 'auto'
  className?: string
}

const Turnstile = forwardRef<TurnstileHandle, TurnstileProps>(function Turnstile(
  { action, onToken, onError, theme = 'light', className },
  ref,
) {
  const hostRef = useRef<HTMLDivElement | null>(null)
  const widgetIdRef = useRef<string | null>(null)

  // Held in refs so a parent that re-creates these callbacks on every render
  // (the normal case with inline arrow functions) does not tear down and
  // re-render the widget, which would throw away an unspent token.
  const onTokenRef = useRef(onToken)
  const onErrorRef = useRef(onError)
  onTokenRef.current = onToken
  onErrorRef.current = onError

  useImperativeHandle(ref, () => ({
    reset() {
      onTokenRef.current('')
      if (widgetIdRef.current && window.turnstile) {
        window.turnstile.reset(widgetIdRef.current)
      }
    },
  }), [])

  useEffect(() => {
    if (!isTurnstileEnabled()) return
    let cancelled = false

    loadTurnstileScript()
      .then(() => {
        if (cancelled || !hostRef.current || !window.turnstile) return
        widgetIdRef.current = window.turnstile.render(hostRef.current, {
          sitekey: TURNSTILE_SITE_KEY,
          action,
          theme,
          callback: (token: string) => onTokenRef.current(token),
          'error-callback': () => {
            onTokenRef.current('')
            onErrorRef.current?.()
          },
          'expired-callback': () => {
            // ~300s after issue. Clear the parent's copy first so a submit
            // that lands in this window is stopped by the button rather than
            // by GoTrue.
            onTokenRef.current('')
            if (widgetIdRef.current && window.turnstile) {
              window.turnstile.reset(widgetIdRef.current)
            }
          },
          'timeout-callback': () => onTokenRef.current(''),
        })
      })
      .catch(() => {
        if (!cancelled) onErrorRef.current?.()
      })

    return () => {
      cancelled = true
      if (widgetIdRef.current && window.turnstile) {
        window.turnstile.remove(widgetIdRef.current)
        widgetIdRef.current = null
      }
    }
  }, [action, theme])

  if (!isTurnstileEnabled()) return null
  return <div ref={hostRef} className={className} data-testid="turnstile" />
})

export default Turnstile

/**
 * The message to show when a form is blocked on the captcha. One place, so the
 * three forms do not drift into three different wordings for the same state.
 */
export const TURNSTILE_PENDING_MESSAGE = 'Please complete the security check below.'
export const TURNSTILE_FAILED_MESSAGE =
  'The security check could not be completed. Refresh the page and try again.'

/**
 * Should the submit button be held? Only when the widget is actually
 * configured — an unconfigured deployment must not lock its own forms.
 */
export function captchaBlocked(token: string): boolean {
  return isTurnstileEnabled() && !token
}
