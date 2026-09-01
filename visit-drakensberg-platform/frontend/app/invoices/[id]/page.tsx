'use client'

import { useEffect, useState, useCallback, useMemo, Suspense } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { Printer, ArrowLeft, CreditCard, Loader2, Copy, Check } from 'lucide-react'
import {
  getInvoiceById, getInvoicePublic, getInvoiceByToken, getReceipts, getFinanceSettings,
  markInvoiceViewed, invoiceShareUrl,
  type Invoice, type InvoiceCustomerOrder, type Receipt,
} from '@/lib/invoices'
import { getOrderById } from '@/lib/orders'
import { getSiteContent, SITE_CONTENT_DEFAULTS } from '@/lib/site-content'
import { supabase } from '@/lib/auth'
import { copyToClipboard } from '@/lib/clipboard'
import { formatMoney } from '@/lib/allocation'
import { DEFAULT_TIP_PRESETS, maxTip, tipForPercent, tippableTotal } from '@/lib/tips'
import Logo from '@/components/Logo'

type BusinessDetails = typeof SITE_CONTENT_DEFAULTS.business_details

// Printable customer invoice. One invoice per Master Order — every purchased
// service on a single document, no supplier payout information.
//
// It opens on its own address, with no session: the id in the URL is
// 'inv-' + a v4 UUID, which vd_invoice_public accepts as the credential.
// Most customers have no account, and a guest order has no user_id for RLS to
// match at all, so requiring a login here locked out the very people the
// invoice is for.
//
// Two fallbacks behind that, in order: a ?t= share token (links emailed
// while the token was the credential), then the signed-in RLS path — which is
// what lets staff open an invoice by its number rather than its id.

function fmt(d?: string | null) {
  return d ? new Date(d).toLocaleDateString('en-ZA', { day: 'numeric', month: 'long', year: 'numeric' }) : '—'
}

function TipOption({ label, sub, selected, onClick }: {
  label: string
  sub?: string
  selected: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={selected}
      className={`px-4 py-2.5 border font-sans text-sm transition-colors ${
        selected
          ? 'bg-[#2d6a4f] border-[#2d6a4f] text-white'
          : 'bg-white border-gray-200 text-gray-600 hover:border-[#2d6a4f] hover:text-[#2d6a4f]'
      }`}
    >
      {label}
      {sub && <span className={`ml-2 text-xs ${selected ? 'text-white/70' : 'text-gray-400'}`}>{sub}</span>}
    </button>
  )
}

/** Hands the current invoice link to any channel — email, WhatsApp, SMS. */
function CopyLinkButton({ url, className = '', label = 'Copy link' }: {
  url: string
  className?: string
  label?: string
}) {
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle')

  async function copy() {
    setState(await copyToClipboard(url) ? 'copied' : 'failed')
    setTimeout(() => setState('idle'), 2500)
  }

  return (
    <button onClick={copy} title={url} className={className}>
      {state === 'copied' ? <Check size={14} /> : <Copy size={14} />}
      {state === 'copied' ? 'Link copied' : state === 'failed' ? 'Press ⌘/Ctrl+C' : label}
    </button>
  )
}

function PrintableInvoiceInner() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const searchParams = useSearchParams()
  const paymentResult = searchParams.get('payment') // success|failed|cancelled
  const shareToken = searchParams.get('t')
  const [invoice, setInvoice] = useState<Invoice | null>(null)
  const [order, setOrder] = useState<InvoiceCustomerOrder | null>(null)
  const [receipts, setReceipts] = useState<Receipt[]>([])
  const [business, setBusiness] = useState<BusinessDetails>(SITE_CONTENT_DEFAULTS.business_details)
  const [loading, setLoading] = useState(true)
  const [signedIn, setSignedIn] = useState<boolean | null>(null)
  const [paying, setPaying] = useState(false)
  const [payError, setPayError] = useState('')
  const [tipping, setTipping] = useState({ enabled: false, presets: DEFAULT_TIP_PRESETS })
  // null = no tip yet, a number = that percentage, 'custom' = the guest's own amount
  const [tipChoice, setTipChoice] = useState<number | 'custom' | null>(null)
  const [customTip, setCustomTip] = useState('')

  useEffect(() => { getSiteContent('business_details').then(setBusiness) }, [])
  useEffect(() => {
    getFinanceSettings().then(s => setTipping({ enabled: s.tippingEnabled, presets: s.tipPresets }))
  }, [])
  // Only used to word the failure state — never to gate the token path.
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setSignedIn(!!data.user)).catch(() => setSignedIn(false))
  }, [])

  const load = useCallback(async (rawId: string): Promise<Invoice | null> => {
    const id = decodeURIComponent(rawId)

    // The address itself, first — this is the path every customer takes, and
    // the only one that works when they have no account.
    const shared = await getInvoicePublic(id) ?? (shareToken ? await getInvoiceByToken(shareToken) : null)
    if (shared) {
      setInvoice(shared.invoice); setOrder(shared.order); setReceipts(shared.receipts)
      return shared.invoice
    }

    // Signed-in fallback: staff, the invoice's own account holder, and
    // lookups by invoice number, which is never a public credential.
    const inv = await getInvoiceById(id)
    setInvoice(inv)
    if (inv) {
      const [o, r] = await Promise.all([getOrderById(inv.order_id), getReceipts(inv.order_id)])
      setOrder(o); setReceipts(r)
    }
    return inv
  }, [shareToken])

  useEffect(() => {
    if (!params?.id) return
    load(params.id)
      .then(inv => {
        // Tell the team the customer opened it. Staff opens are dropped by
        // the database function, so this stays a customer signal.
        if (inv) markInvoiceViewed({ token: shareToken, invoiceId: inv.id })
      })
      .finally(() => setLoading(false))
    // Runs once per invoice: `load` changes only when the token does.
  }, [params?.id, load, shareToken])

  // A successful gateway redirect can arrive slightly before the webhook has
  // reconciled the payment — poll briefly so the balance updates without a
  // manual refresh, instead of just trusting the redirect itself.
  useEffect(() => {
    if (paymentResult !== 'success' || !params?.id) return
    let attempts = 0
    const interval = setInterval(async () => {
      attempts += 1
      const inv = await load(params.id)
      if ((inv && inv.status === 'paid') || attempts >= 6) clearInterval(interval)
    }, 2500)
    return () => clearInterval(interval)
  }, [paymentResult, params?.id, load])

  // The guided portion of the invoice — a tip is a percentage of what the
  // guides did, not of the chalet, the permits or the VAT.
  const tippable = useMemo(() => tippableTotal(invoice?.lines), [invoice])
  const tipCeiling = maxTip(tippable)
  const tip = useMemo(() => {
    if (tipChoice === null) return 0
    if (tipChoice === 'custom') {
      const value = Math.round((parseFloat(customTip) || 0) * 100) / 100
      return value > 0 ? value : 0
    }
    return tipForPercent(tippable, tipChoice)
  }, [tipChoice, customTip, tippable])
  const tipTooLarge = tip > tipCeiling
  const payable = !!invoice && Number(invoice.balance) > 0 && invoice.status !== 'void'

  async function payNow() {
    if (!invoice) return
    if (tipTooLarge) return
    setPaying(true)
    setPayError('')
    try {
      const res = await fetch('/api/payments/ikhokha/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // The token goes with it: a customer who opened the invoice from a
        // link has no session for the API to authorise them by.
        body: JSON.stringify({ invoiceId: invoice.id, tip, shareToken: shareToken || undefined }),
      })
      const json = await res.json()
      if (!res.ok || !json.paylinkUrl) throw new Error(json.error || 'Could not start payment')
      window.location.href = json.paylinkUrl
    } catch (e) {
      setPayError(e instanceof Error ? e.message : 'Could not start payment')
      setPaying(false)
    }
  }

  // Hold the spinner until the session check lands too — the failure state
  // below is worded from it, and flashing the wrong reason at someone who
  // just wants their invoice helps nobody.
  if (loading || (!invoice && signedIn === null)) {
    return <div className="min-h-screen bg-[#F7F5F2] flex items-center justify-center pt-24 font-sans text-sm text-gray-400">Loading invoice…</div>
  }
  if (!invoice) {
    // An invoice opens on its own address now, so reaching here means the
    // address leads nowhere: mistyped, cut short in transit, or withdrawn.
    // None of that is fixable by signing in — telling customers to was the
    // complaint — so this asks us for a working link instead, and mentions
    // signing in only as an aside for the minority who have an account.
    const currentPath = typeof window !== 'undefined'
      ? window.location.pathname + window.location.search
      : `/invoices/${params?.id ?? ''}`

    return (
      <div className="min-h-screen bg-[#F7F5F2] flex items-center justify-center px-4 pt-24 pb-16">
        <div className="bg-white border border-gray-200 p-8 sm:p-10 max-w-md w-full text-center">
          <p className="font-sans text-[10px] tracking-[0.14em] uppercase text-gray-400">Invoice</p>
          <h1 className="font-display italic text-2xl text-[#000000] mt-1">This invoice link isn&apos;t working</h1>
          <p className="font-sans text-sm text-gray-500 mt-3 leading-relaxed">
            The address didn&apos;t lead to an invoice. It may have been cut short on its way to you,
            or replaced with a newer one.
          </p>
          <p className="font-sans text-sm text-gray-500 mt-3 leading-relaxed">
            Send us a message and we&apos;ll get a working link to you right away
            {business.email ? <> — <a href={`mailto:${business.email}?subject=${encodeURIComponent('Invoice link')}`} className="text-[#2d6a4f] hover:underline">{business.email}</a></> : null}
            {business.phone ? <> or {business.phone}</> : null}.
          </p>
          <div className="flex flex-col gap-2 mt-6">
            {/* A link opened from an email has no history to go back to. */}
            <a href="/" className="bg-[#2d6a4f] text-white px-5 py-2.5 font-sans text-sm hover:bg-[#245741] transition-colors">
              Go to Visit Drakensberg
            </a>
            {!signedIn && (
              <a
                href={`/auth/login?redirect=${encodeURIComponent(currentPath)}`}
                className="font-sans text-xs text-gray-400 hover:text-[#2d6a4f] hover:underline py-1"
              >
                Have an account with us? Sign in
              </a>
            )}
          </div>
        </div>
      </div>
    )
  }

  // The address in the browser bar is the shareable link, so there is always
  // one to offer — unless staff have withdrawn it, in which case passing it
  // on would only send someone to the error above.
  const shareUrl = invoice.share_revoked_at ? '' : invoiceShareUrl(invoice)

  return (
    <div className="min-h-screen print:min-h-0 bg-[#F7F5F2] print:bg-white pt-28 print:pt-0 pb-16 print:pb-0 px-4 print:px-0">
      {/* Print isolation: every other block on this page already carries
          print:hidden, so #invoice-doc is the only thing left in the print
          flow — no need for the old visibility:hidden + position:absolute
          overlay trick, which is what produced the duplicated/overlapping
          content and the stray blank page: an invisible-but-still-
          min-h-screen-tall ancestor still consumes page height even though
          nothing on it is drawn, and Chrome can repaint an absolutely
          positioned box on every generated page.
          @page margin is 0 on purpose — that margin is exactly where the
          browser draws its own header/footer (page title, URL, date, page
          number), so leaving it in place always printed the address bar
          onto the invoice. The 14mm of breathing room it used to provide
          is added back below as padding on #invoice-doc itself, which the
          browser has no header/footer to put there. */}
      <style>{`
        @media print {
          #invoice-doc {
            padding: 14mm !important;
            box-shadow: none !important; border: none !important;
            -webkit-print-color-adjust: exact; print-color-adjust: exact;
          }
          #invoice-doc tr { break-inside: avoid; }
          #invoice-doc thead { display: table-header-group; }
          @page { size: auto; margin: 0; }
        }
      `}</style>

      <div className="max-w-[820px] print:max-w-none mx-auto print:mx-0">
        {paymentResult === 'success' && (
          <div className="mb-4 print:hidden bg-[#2d6a4f]/10 border border-[#2d6a4f]/30 text-[#2d6a4f] font-sans text-sm px-4 py-3 flex items-center gap-2">
            {invoice.status !== 'paid' && <Loader2 size={14} className="animate-spin shrink-0" />}
            {invoice.status === 'paid' ? 'Payment received — thank you!' : 'Payment received — confirming with the bank, this page will update automatically…'}
          </div>
        )}
        {paymentResult === 'failed' && (
          <div className="mb-4 print:hidden bg-red-50 border border-red-200 text-red-600 font-sans text-sm px-4 py-3">
            The payment didn't go through — your card was declined. Please check your card details and try again below.
          </div>
        )}
        {paymentResult === 'cancelled' && (
          <div className="mb-4 print:hidden bg-amber-50 border border-amber-200 text-amber-700 font-sans text-sm px-4 py-3">
            Payment cancelled — your invoice balance is unchanged.
          </div>
        )}
        {/* Persistent decline notice: shown when the gateway declined a previous
            payment attempt and the invoice is still unpaid, but the customer is
            not arriving directly from that declined attempt (which shows the
            more specific ?payment=failed banner above). */}
        {!paymentResult && invoice.payment_declined_at && invoice.status !== 'paid' && (
          <div className="mb-4 print:hidden bg-red-50 border border-red-200 text-red-600 font-sans text-sm px-4 py-3">
            A recent payment attempt was declined. Please check your card details and try again below, or contact us if you need help.
          </div>
        )}

        {/* Gratuity — only where there is something guided to tip on, and only
            while the invoice can still be paid. */}
        {payable && tipping.enabled && tippable > 0 && (
          <div className="mb-4 print:hidden bg-white border border-gray-200 p-5 sm:p-6">
            <p className="font-sans text-[10px] tracking-[0.14em] uppercase text-gray-400">Gratuity</p>
            <h2 className="font-display italic text-xl sm:text-2xl text-[#000000] mt-1">Add a tip for your guide?</h2>
            <p className="font-sans text-xs text-gray-500 mt-1.5 max-w-xl leading-relaxed">
              The guided part of this invoice came to {formatMoney(tippable, invoice.currency)}. A tip is entirely
              optional, and every cent of it goes to the operator who took you out — no commission, no VAT.
            </p>

            <div className="flex flex-wrap gap-2 mt-4">
              <TipOption label="No tip" selected={tipChoice === null} onClick={() => { setTipChoice(null); setCustomTip('') }} />
              {tipping.presets.map(p => (
                <TipOption
                  key={p}
                  label={`${p}%`}
                  sub={formatMoney(tipForPercent(tippable, p), invoice.currency)}
                  selected={tipChoice === p}
                  onClick={() => setTipChoice(p)}
                />
              ))}
              <TipOption label="Other amount" selected={tipChoice === 'custom'} onClick={() => setTipChoice('custom')} />
            </div>

            {tipChoice === 'custom' && (
              <div className="mt-3 flex items-center gap-2">
                <span className="font-sans text-sm text-gray-500">{invoice.currency === 'ZAR' ? 'R' : invoice.currency}</span>
                <input
                  value={customTip}
                  onChange={e => setCustomTip(e.target.value)}
                  inputMode="decimal"
                  autoFocus
                  placeholder="0.00"
                  aria-label="Tip amount"
                  className="w-32 border border-gray-200 px-3 py-2.5 font-sans text-base sm:text-sm text-right focus:outline-none focus:border-[#2d6a4f]"
                />
              </div>
            )}

            {tipTooLarge ? (
              <p className="mt-3 font-sans text-xs text-red-600">
                A tip can't be more than the guided part of the invoice ({formatMoney(tipCeiling, invoice.currency)}).
                Enter a smaller amount, or pay this invoice and arrange anything larger with us directly.
              </p>
            ) : tip > 0 && (
              <p className="mt-3 font-sans text-sm text-gray-600">
                Balance {formatMoney(Number(invoice.balance), invoice.currency)} + tip {formatMoney(tip, invoice.currency)} ={' '}
                <span className="font-medium text-[#000000]">{formatMoney(Number(invoice.balance) + tip, invoice.currency)}</span>
              </p>
            )}
            <p className="mt-2 font-sans text-[11px] text-gray-400">
              The tip is added to your invoice only once the payment goes through, and appears on it as its own line.
            </p>
          </div>
        )}

        {/* Wraps rather than squeezes: on a phone this row now carries a
            third action. */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4 print:hidden">
          <button onClick={() => router.back()} className="inline-flex items-center gap-2 font-sans text-sm text-gray-500 hover:text-[#2d6a4f] transition-colors">
            <ArrowLeft size={14} /> Back
          </button>
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            {shareUrl && (
              <CopyLinkButton
                url={shareUrl}
                className="inline-flex items-center gap-2 border border-gray-200 bg-white text-gray-600 px-4 py-2.5 font-sans text-sm hover:border-[#2d6a4f] hover:text-[#2d6a4f] transition-colors"
              />
            )}
            {payable && (
              <button
                onClick={payNow}
                disabled={paying || tipTooLarge}
                className="inline-flex items-center gap-2 bg-[#C9A96E] text-[#2d2d2d] px-5 py-2.5 font-sans text-sm font-medium hover:bg-[#b8935e] transition-colors disabled:opacity-60"
              >
                <CreditCard size={14} /> {paying ? 'Redirecting…' : `Pay Now — ${formatMoney(Number(invoice.balance) + tip, invoice.currency)}`}
              </button>
            )}
            <button onClick={() => window.print()} className="inline-flex items-center gap-2 bg-[#2d6a4f] text-white px-5 py-2.5 font-sans text-sm hover:bg-[#245741] transition-colors">
              <Printer size={14} /> Print / Save as PDF
            </button>
          </div>
        </div>
        {payError && <p className="font-sans text-xs text-red-600 mb-4 print:hidden text-right">{payError}</p>}

        <div id="invoice-doc" className="bg-white border border-gray-200 p-10">
          {/* Header */}
          <div className="flex items-start justify-between pb-8 print:pb-5 border-b border-gray-200">
            <div>
              <Logo className="h-6 w-auto text-[#2d6a4f]" />
              <p className="font-sans text-xs text-gray-400 mt-3 leading-relaxed">
                {business.business_name}<br />
                {[business.address_line1, business.address_line2, business.city, business.country].filter(Boolean).join(', ') || 'KwaZulu-Natal, South Africa'}<br />
                {business.email}
                {business.phone && <><br />{business.phone}</>}
                {business.registration_number && <><br />Reg. {business.registration_number}</>}
                {business.vat_number && <><br />VAT {business.vat_number}</>}
              </p>
            </div>
            <div className="text-right shrink-0 pl-6">
              <p className="font-sans text-[10px] tracking-[0.2em] uppercase text-[#C9A96E] mb-1">
                {invoice.status === 'void' ? 'Void Invoice' : 'Tax Invoice'}
              </p>
              <h1 className="font-display italic text-3xl text-[#000000]">{invoice.invoice_number}</h1>
              <p className="font-sans text-xs text-gray-400 mt-2">Issued {fmt(invoice.issued_at)}</p>
              <p className={`font-sans text-[10px] tracking-[0.1em] uppercase inline-block px-2.5 py-1 mt-2 ${
                invoice.status === 'paid' ? 'bg-[#2d6a4f]/10 text-[#2d6a4f]'
                : invoice.status === 'void' || invoice.status === 'refunded' ? 'bg-red-50 text-red-400'
                : 'bg-[#C9A96E]/15 text-[#8B6914]'}`}>
                {invoice.status}
              </p>
            </div>
          </div>

          {/* Bill to / trip */}
          <div className="grid grid-cols-2 gap-8 py-8 print:py-5 border-b border-gray-200">
            <div>
              <p className="font-sans text-[10px] tracking-[0.14em] uppercase text-gray-400 mb-2">Billed To</p>
              <p className="font-sans text-sm font-medium text-gray-800">{order?.customer_name || '—'}</p>
              <p className="font-sans text-xs text-gray-500 mt-0.5">{order?.customer_email}</p>
            </div>
            <div className="text-right">
              <p className="font-sans text-[10px] tracking-[0.14em] uppercase text-gray-400 mb-2">Trip</p>
              <p className="font-sans text-sm text-gray-800">{order?.trip_name || '—'}</p>
              <p className="font-sans text-xs text-gray-500 mt-0.5">
                Order {order?.order_number}{order?.travel_start ? ` · ${fmt(order.travel_start)}${order.travel_end && order.travel_end !== order.travel_start ? ` — ${fmt(order.travel_end)}` : ''}` : ''}
              </p>
            </div>
          </div>

          {/* Lines */}
          <div className="overflow-x-auto">
          <table className="w-full my-8 print:my-5 min-w-[480px]">
            <thead>
              <tr className="border-b-2 border-gray-800">
                <th className="text-left py-2.5 print:py-1.5 font-sans text-[10px] tracking-[0.14em] uppercase text-gray-500">Service</th>
                <th className="text-right py-2.5 print:py-1.5 font-sans text-[10px] tracking-[0.14em] uppercase text-gray-500">Qty</th>
                <th className="text-right py-2.5 print:py-1.5 font-sans text-[10px] tracking-[0.14em] uppercase text-gray-500">Unit Price</th>
                <th className="text-right py-2.5 print:py-1.5 font-sans text-[10px] tracking-[0.14em] uppercase text-gray-500">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {invoice.lines.map((l, i) => (
                <tr key={i}>
                  <td className="py-3 print:py-1.5 pr-4">
                    <p className="font-sans text-sm text-gray-800">{l.title}</p>
                    {l.description && (
                      <p className="font-sans text-[12px] text-gray-600 mt-0.5 whitespace-pre-wrap">{l.description}</p>
                    )}
                    <p className="font-sans text-[11px] text-gray-400 capitalize mt-0.5">{l.category}</p>
                  </td>
                  <td className="py-3 print:py-1.5 text-right font-sans text-sm text-gray-600 whitespace-nowrap">{Number(l.quantity)} {l.unitLabel}{Number(l.quantity) !== 1 ? 's' : ''}</td>
                  <td className="py-3 print:py-1.5 text-right font-sans text-sm text-gray-600 whitespace-nowrap">{formatMoney(Number(l.unitPrice), invoice.currency)}</td>
                  <td className="py-3 print:py-1.5 text-right font-sans text-sm text-gray-800 whitespace-nowrap">{formatMoney(Number(l.total), invoice.currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>

          {/* Totals */}
          <div className="flex justify-end print:break-inside-avoid">
            <div className="w-72 space-y-2 print:space-y-1 font-sans text-sm">
              <div className="flex justify-between text-gray-600"><span>Subtotal</span><span>{formatMoney(Number(invoice.subtotal), invoice.currency)}</span></div>
              {Number(invoice.discount) > 0 && (
                <div className="flex justify-between text-gray-600"><span>Discount</span><span>−{formatMoney(Number(invoice.discount), invoice.currency)}</span></div>
              )}
              <div className="flex justify-between text-gray-600"><span>Service fee</span><span>{formatMoney(Number(invoice.service_fee), invoice.currency)}</span></div>
              <div className="flex justify-between text-gray-600"><span>VAT</span><span>{formatMoney(Number(invoice.tax_amount), invoice.currency)}</span></div>
              <div className="flex justify-between font-medium text-base text-[#000000] border-t-2 border-gray-800 pt-2">
                <span>Total</span><span>{formatMoney(Number(invoice.total), invoice.currency)}</span>
              </div>
              <div className="flex justify-between text-[#2d6a4f]"><span>Amount paid</span><span>{formatMoney(Number(invoice.amount_paid), invoice.currency)}</span></div>
              <div className="flex justify-between font-medium text-gray-800"><span>Balance due</span><span>{formatMoney(Number(invoice.balance), invoice.currency)}</span></div>
            </div>
          </div>

          {/* Receipts */}
          {receipts.length > 0 && (
            <div className="mt-10 print:mt-6 pt-6 print:pt-4 border-t border-gray-200 print:break-inside-avoid">
              <p className="font-sans text-[10px] tracking-[0.14em] uppercase text-gray-400 mb-2">Payments Received</p>
              {receipts.map(r => (
                <div key={r.id} className="flex justify-between font-sans text-xs text-gray-500 py-1 print:py-0.5">
                  <span>{r.receipt_number} · {fmt(r.created_at)} · {r.method}</span>
                  <span>{Number(r.amount) < 0 ? `−${formatMoney(Math.abs(Number(r.amount)), r.currency)} (refund)` : formatMoney(Number(r.amount), r.currency)}</span>
                </div>
              ))}
            </div>
          )}

          {Number(invoice.balance) > 0 && business.bank_account_number && (
            <div className="mt-10 print:mt-6 pt-6 print:pt-4 border-t border-gray-200 print:break-inside-avoid">
              <p className="font-sans text-[10px] tracking-[0.14em] uppercase text-gray-400 mb-2">Pay by EFT</p>
              <div className="grid grid-cols-2 gap-x-8 gap-y-1 font-sans text-xs text-gray-600 max-w-md">
                {business.bank_name && <><span className="text-gray-400">Bank</span><span>{business.bank_name}</span></>}
                {business.bank_account_holder && <><span className="text-gray-400">Account holder</span><span>{business.bank_account_holder}</span></>}
                <span className="text-gray-400">Account number</span><span>{business.bank_account_number}</span>
                {business.bank_branch_code && <><span className="text-gray-400">Branch code</span><span>{business.bank_branch_code}</span></>}
                <span className="text-gray-400">Reference</span><span>{invoice.invoice_number}</span>
              </div>
            </div>
          )}

          {business.invoice_footer_note && (
            <p className="mt-6 print:mt-4 font-sans text-[11px] text-gray-400 leading-relaxed whitespace-pre-line">{business.invoice_footer_note}</p>
          )}

          <p className="mt-10 print:mt-6 pt-6 print:pt-4 border-t border-gray-200 font-sans text-[11px] text-gray-400 leading-relaxed">
            This invoice covers all services in your trip, arranged through {business.business_name}.
            Payments reconcile against order {order?.order_number}. Thank you for exploring the Drakensberg with us.
          </p>
        </div>
      </div>
    </div>
  )
}

export default function PrintableInvoicePage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#F7F5F2] flex items-center justify-center pt-24 font-sans text-sm text-gray-400">Loading invoice…</div>}>
      <PrintableInvoiceInner />
    </Suspense>
  )
}
