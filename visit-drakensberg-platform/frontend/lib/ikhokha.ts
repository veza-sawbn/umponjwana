import { createHmac } from 'crypto'

// iKhokha "iK Pay API" client — SERVER ONLY. Reads secret credentials from
// process.env and must never be imported by a client component; it is only
// ever called from app/api/payments/ikhokha/* route handlers.
//
// Reverse-engineered from iKhokha's public examples repo
// (github.com/ikhokha/ik-pay-api-examples) since the interactive developer
// docs at developer.ikhokha.com could not be fetched from this environment.
// Field names, the HMAC-SHA256 signing scheme (hex digest of `path +
// JSON.stringify(body)`, keyed by the App Key) and the IK-APPID/IK-SIGN
// headers all come from that reference implementation. Verify against real
// sandbox credentials before taking a live payment — in particular confirm
// entityID/externalEntityID are the right values for this merchant account.

const BASE_URL = 'https://api.ikhokha.com/public-api/v1/api'

function credentials() {
  const appId = process.env.IKHOKHA_APP_ID
  const appKey = process.env.IKHOKHA_APP_KEY
  if (!appId || !appKey) {
    throw new Error('iKhokha is not configured — set IKHOKHA_APP_ID and IKHOKHA_APP_KEY')
  }
  return { appId, appKey }
}

function sign(path: string, body: string, appKey: string): string {
  return createHmac('sha256', appKey).update(path + body).digest('hex')
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
      'IK-SIGN': sign(path, bodyStr, appKey),
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
