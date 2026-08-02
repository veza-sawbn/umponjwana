import { createHmac } from 'crypto'

// iKhokha "iK Pay API" client — SERVER ONLY. Reads secret credentials from
// process.env and must never be imported by a client component; it is only
// ever called from app/api/payments/ikhokha/* route handlers.
//
// Signing scheme verified 2026-08-02 against the official reference
// implementation (github.com/ikhokha/ik-pay-api-examples, nodejs/index.js
// and nodejs/pay-api-app/backend/paylink.js) after a live request failed
// with IK-001 "Token or Hash invalid" — the two bugs that caused it:
//   1. The signed payload must use the request's FULL URL path
//      (/public-api/v1/api/payment), not just the fragment appended to
//      BASE_URL (/payment) that an earlier version of this file signed.
//   2. The payload (path + JSON body) must be escaped before hashing:
//      backslash/double-quote/single-quote get a backslash prefix, and each
//      NUL byte (code point 0) becomes the literal two-character sequence
//      backslash-zero — see escape() below, which matches the reference's
//      String.replace(/[\\"']/g, "\\$&").replace(/\u0000/g, "\\0") exactly.
// The reference also trims the App ID/App Key/signature before use, which
// this file now does too (protects against trailing whitespace pasted into
// an env var).

const BASE_URL = 'https://api.ikhokha.com/public-api/v1/api'
const BASE_PATH = '/public-api/v1/api' // full pathname signed requests must use

function credentials() {
  const appId = process.env.IKHOKHA_APP_ID?.trim()
  const appKey = process.env.IKHOKHA_APP_KEY?.trim()
  if (!appId || !appKey) {
    throw new Error('iKhokha is not configured — set IKHOKHA_APP_ID and IKHOKHA_APP_KEY')
  }
  return { appId, appKey }
}

function escape(payload: string): string {
  return payload.replace(/[\\"']/g, '\\$&').replace(/\u0000/g, '\\0')
}

function sign(fullPath: string, body: string, appKey: string): string {
  return createHmac('sha256', appKey).update(escape(fullPath + body)).digest('hex')
}

async function ikhokhaRequest<T>(method: 'GET' | 'POST', path: string, body?: unknown): Promise<T> {
  const { appId, appKey } = credentials()
  const bodyStr = body !== undefined ? JSON.stringify(body) : ''
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'IK-APPID': appId,
      'IK-SIGN': sign(`${BASE_PATH}${path}`, bodyStr, appKey),
    },
    body: method === 'POST' ? bodyStr : undefined,
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error((json as { message?: string })?.message || `iKhokha request failed (${res.status})`)
  }
  return json as T
}

export type CreatePaymentLinkInput = {
  amount: number // major currency units (rand) — converted to cents below
  currency?: string
  description: string
  paymentReference: string
  externalTransactionID: string
  requesterUrl: string
  callbackUrl: string
  successPageUrl: string
  failurePageUrl: string
  cancelUrl: string
}

export type CreatePaymentLinkResponse = {
  responseCode: string
  message?: string
  paylinkUrl: string
  paylinkID: string
  externalTransactionID: string
}

export async function createPaymentLink(input: CreatePaymentLinkInput): Promise<CreatePaymentLinkResponse> {
  const { appId } = credentials()
  const mode = process.env.IKHOKHA_MODE === 'live' ? 'live' : 'test'
  return ikhokhaRequest<CreatePaymentLinkResponse>('POST', '/payment', {
    entityID: process.env.IKHOKHA_ENTITY_ID || appId,
    externalEntityID: process.env.IKHOKHA_EXTERNAL_ENTITY_ID || appId,
    amount: Math.round(input.amount * 100),
    currency: input.currency ?? 'ZAR',
    requesterUrl: input.requesterUrl,
    description: input.description,
    paymentReference: input.paymentReference,
    mode,
    externalTransactionID: input.externalTransactionID,
    urls: {
      callbackUrl: input.callbackUrl,
      successPageUrl: input.successPageUrl,
      failurePageUrl: input.failurePageUrl,
      cancelUrl: input.cancelUrl,
    },
  })
}

export type PaymentLinkStatus = {
  responseCode?: string
  status?: string
  paylinkID?: string
  externalTransactionID?: string
  [key: string]: unknown
}

/** Authoritative, signed server-to-server status check — never trust a webhook body alone. */
export async function getPaymentLinkStatus(paylinkID: string): Promise<PaymentLinkStatus> {
  return ikhokhaRequest<PaymentLinkStatus>('GET', `/getStatus/${paylinkID}`)
}

export function isIkhokhaConfigured(): boolean {
  return !!(process.env.IKHOKHA_APP_ID && process.env.IKHOKHA_APP_KEY)
}
