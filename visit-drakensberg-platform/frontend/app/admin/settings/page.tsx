'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { Save, CheckCircle, MessageCircle, ChevronRight, AlertTriangle } from 'lucide-react'
import { getSiteContent, setSiteContent, SITE_CONTENT_DEFAULTS } from '@/lib/site-content'
import { getFinanceSettings, setFinanceSettings } from '@/lib/invoices'

type BusinessDetails = typeof SITE_CONTENT_DEFAULTS.business_details

function BusinessDetailsCard() {
  const [details, setDetails] = useState<BusinessDetails>(SITE_CONTENT_DEFAULTS.business_details)
  const [saving, setSaving] = useState(false)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => { getSiteContent('business_details').then(d => { setDetails(d); setLoaded(true) }) }, [])

  const set = (k: keyof BusinessDetails, v: string) => setDetails(d => ({ ...d, [k]: v }))

  async function save() {
    setSaving(true)
    try {
      await setSiteContent('business_details', details)
      toast.success('Business details saved.')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not save business details')
    } finally {
      setSaving(false)
    }
  }

  const field = (label: string, key: keyof BusinessDetails, placeholder = '') => (
    <div>
      <label className="block font-sans text-[10px] tracking-[0.12em] uppercase text-gray-400 mb-1.5">{label}</label>
      <input
        value={details[key]}
        onChange={e => set(key, e.target.value)}
        placeholder={placeholder}
        className="w-full border border-gray-200 px-4 py-3 font-sans text-sm focus:outline-none focus:border-[#2d6a4f] bg-[#F7F5F2]"
      />
    </div>
  )

  return (
    <div className="bg-white border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-5">
        <h2 className="font-display italic text-xl">Business Details</h2>
        <button onClick={save} disabled={!loaded || saving} className="inline-flex items-center gap-1.5 font-sans text-xs text-[#2d6a4f] hover:underline disabled:opacity-50">
          <Save size={12} /> {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
      <p className="font-sans text-xs text-gray-400 mb-5">Appears on every invoice and quote — legal name, registration/VAT numbers, and banking details for EFT payers.</p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {field('Business Name', 'business_name')}
        {field('Registration Number', 'registration_number', 'e.g. 2024/000000/07')}
        {field('VAT Number', 'vat_number', 'e.g. 4123456789')}
        {field('Email', 'email')}
        {field('Phone', 'phone', '+27 33 000 0000')}
        {field('Country', 'country')}
        {field('Address Line 1', 'address_line1')}
        {field('Address Line 2', 'address_line2')}
        {field('City', 'city')}
        {field('Postal Code', 'postal_code')}
      </div>
      <div className="h-px bg-gray-100 my-5" />
      <p className="font-sans text-[10px] tracking-[0.12em] uppercase text-gray-400 mb-3">Banking Details (for EFT payments)</p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {field('Bank Name', 'bank_name')}
        {field('Account Holder', 'bank_account_holder')}
        {field('Account Number', 'bank_account_number')}
        {field('Branch Code', 'bank_branch_code')}
      </div>
      <div className="mt-4">
        <label className="block font-sans text-[10px] tracking-[0.12em] uppercase text-gray-400 mb-1.5">Invoice Footer Note (optional)</label>
        <textarea
          value={details.invoice_footer_note}
          onChange={e => set('invoice_footer_note', e.target.value)}
          rows={2}
          placeholder="e.g. Thank you for your business — payment due within 7 days."
          className="w-full border border-gray-200 px-4 py-3 font-sans text-sm focus:outline-none focus:border-[#2d6a4f] bg-[#F7F5F2] resize-none"
        />
      </div>
    </div>
  )
}

function TaxSettingsCard() {
  const [vatRate, setVatRate] = useState('15')
  const [serviceFeeRate, setServiceFeeRate] = useState('12')
  const [currency, setCurrency] = useState('ZAR')
  const [tippingEnabled, setTippingEnabled] = useState(true)
  const [tipPresets, setTipPresets] = useState('10, 15, 20')
  const [saving, setSaving] = useState(false)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    getFinanceSettings().then(s => {
      setVatRate(String(Math.round(s.vatRate * 1000) / 10))
      setServiceFeeRate(String(Math.round(s.serviceFeeRate * 1000) / 10))
      setCurrency(s.currency)
      setTippingEnabled(s.tippingEnabled)
      setTipPresets(s.tipPresets.join(', '))
      setLoaded(true)
    })
  }, [])

  async function save() {
    setSaving(true)
    try {
      // Blank or unparseable presets fall back to the stored defaults rather
      // than saving an empty selector onto the invoice.
      const presets = tipPresets.split(',')
        .map(p => parseFloat(p.trim()))
        .filter(n => Number.isFinite(n) && n > 0 && n <= 100)
      await setFinanceSettings({
        vatRate: (parseFloat(vatRate) || 0) / 100,
        serviceFeeRate: (parseFloat(serviceFeeRate) || 0) / 100,
        currency,
        tippingEnabled,
        ...(presets.length > 0 ? { tipPresets: presets } : {}),
      })
      toast.success('Tax & fee settings saved.')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not save settings')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="bg-white border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-5">
        <h2 className="font-display italic text-xl">Tax & Fees</h2>
        <button onClick={save} disabled={!loaded || saving} className="inline-flex items-center gap-1.5 font-sans text-xs text-[#2d6a4f] hover:underline disabled:opacity-50">
          <Save size={12} /> {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
      <p className="font-sans text-xs text-gray-400 mb-5">Applied by default to every new order, invoice and quote — individual documents can still override these.</p>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block font-sans text-[10px] tracking-[0.12em] uppercase text-gray-400 mb-1.5">VAT Rate (%)</label>
          <input type="number" step="0.1" min="0" value={vatRate} onChange={e => setVatRate(e.target.value)} className="w-full border border-gray-200 px-4 py-3 font-sans text-sm focus:outline-none focus:border-[#2d6a4f] bg-[#F7F5F2]" />
        </div>
        <div>
          <label className="block font-sans text-[10px] tracking-[0.12em] uppercase text-gray-400 mb-1.5">Default Service Fee (%)</label>
          <input type="number" step="0.1" min="0" value={serviceFeeRate} onChange={e => setServiceFeeRate(e.target.value)} className="w-full border border-gray-200 px-4 py-3 font-sans text-sm focus:outline-none focus:border-[#2d6a4f] bg-[#F7F5F2]" />
        </div>
        <div>
          <label className="block font-sans text-[10px] tracking-[0.12em] uppercase text-gray-400 mb-1.5">Currency</label>
          <input value={currency} onChange={e => setCurrency(e.target.value.toUpperCase())} maxLength={3} className="w-full border border-gray-200 px-4 py-3 font-sans text-sm focus:outline-none focus:border-[#2d6a4f] bg-[#F7F5F2]" />
        </div>
      </div>

      {/* Gratuities — guests tipping guides when they pay an activity invoice online. */}
      <div className="mt-6 pt-6 border-t border-gray-100">
        <p className="font-sans text-[10px] tracking-[0.12em] uppercase text-gray-400 mb-1.5">Gratuities</p>
        <p className="font-sans text-xs text-gray-400 mb-4">
          Offers guests a tip when they pay an invoice that includes an activity, tour, hike or shuttle online.
          A tip carries no commission and no VAT — it is allocated in full to the operator and paid out with their next settlement.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
          <label className="flex items-center gap-3 border border-gray-200 bg-[#F7F5F2] px-4 py-3 cursor-pointer">
            <input type="checkbox" checked={tippingEnabled} onChange={e => setTippingEnabled(e.target.checked)} className="accent-[#2d6a4f]" />
            <span className="font-sans text-sm text-gray-700">Allow tips on activity invoices</span>
          </label>
          <div className="md:col-span-2">
            <label className="block font-sans text-[10px] tracking-[0.12em] uppercase text-gray-400 mb-1.5">Suggested Percentages</label>
            <input
              value={tipPresets}
              onChange={e => setTipPresets(e.target.value)}
              placeholder="10, 15, 20"
              disabled={!tippingEnabled}
              className="w-full border border-gray-200 px-4 py-3 font-sans text-sm focus:outline-none focus:border-[#2d6a4f] bg-[#F7F5F2] disabled:text-gray-400"
            />
            <p className="font-sans text-[11px] text-gray-400 mt-1.5">Comma separated. Guests can always enter their own amount instead.</p>
          </div>
        </div>
      </div>
    </div>
  )
}

type PlatformSettings = typeof SITE_CONTENT_DEFAULTS.platform_settings

type PaymentStatus = {
  configured: boolean
  mode: 'live' | 'test'
  rawMode: string | null
  hasEntityId: boolean
  hasExternalEntityId: boolean
  siteUrlSet: boolean
  origin: string
}

/**
 * Whether card payments are taking real money — read-only, because it is
 * decided by environment variables on the host, not by anything in here.
 *
 * It exists because there was no way to tell from inside the product, and a
 * site stuck in test mode looks identical to a working one: customers get a
 * payment page, it says "paid", and nothing reaches the bank.
 */
function PaymentModeCard() {
  const [status, setStatus] = useState<PaymentStatus | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    fetch('/api/payments/ikhokha/status')
      .then(r => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then(setStatus)
      .catch(() => setFailed(true))
  }, [])

  const live = status?.mode === 'live'
  // A value that isn't exactly 'live' but looks like it was meant to be —
  // 'Live', 'LIVE ', 'production' — is the failure that costs real money.
  const looksMistyped = !!status && !live && !!status.rawMode && status.rawMode.toLowerCase() !== 'test'

  const warnings = status ? [
    !status.configured && 'No app credentials — IKHOKHA_APP_ID and IKHOKHA_APP_KEY are unset, so Pay Now is switched off entirely.',
    looksMistyped && `IKHOKHA_MODE is "${status.rawMode}", which is not the exact string "live" — this site is taking test payments.`,
    live && !status.hasEntityId && 'IKHOKHA_ENTITY_ID is unset, so the App ID is being sent as the merchant entity. That is a guess — set it explicitly.',
    !status.siteUrlSet && 'NEXT_PUBLIC_SITE_URL is unset. Links fall back to the request host, which is usually right on Vercel but wrong for anything server-initiated.',
  ].filter(Boolean) as string[] : []

  return (
    <div className="bg-white border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-1">
        <h2 className="font-display italic text-xl">Card Payments</h2>
        {status && (
          <span className={`font-sans text-[10px] tracking-[0.14em] uppercase px-3 py-1 ${
            !status.configured ? 'bg-gray-100 text-gray-500'
            : live ? 'bg-[#2d6a4f]/10 text-[#2d6a4f]'
            : 'bg-[#C9A96E]/20 text-[#8B6914]'}`}>
            {!status.configured ? 'Not set up' : live ? 'Live — real money' : 'Test mode'}
          </span>
        )}
      </div>
      <p className="font-sans text-xs text-gray-400 mb-5">
        Set on the host (Vercel), not here — changing it needs a redeploy to take effect.
      </p>

      {failed && <p className="font-sans text-sm text-gray-400">Could not read the payment configuration.</p>}
      {!status && !failed && <p className="font-sans text-sm text-gray-400">Checking…</p>}

      {status && (
        <>
          {!live && status.configured && !looksMistyped && (
            <p className="font-sans text-sm text-gray-600 leading-relaxed mb-4">
              Payments are in test mode. Customers see a working payment page and invoices are marked paid,
              but no money moves. Set <code className="font-mono text-xs bg-[#F7F5F2] px-1.5 py-0.5">IKHOKHA_MODE=live</code> and
              swap in your live iKhokha credentials to go live.
            </p>
          )}
          {live && (
            <p className="font-sans text-sm text-gray-600 leading-relaxed mb-4">
              Payments are live. Every Pay Now charges the customer's card for real.
            </p>
          )}

          {warnings.length > 0 && (
            <ul className="space-y-2 mb-4">
              {warnings.map(w => (
                <li key={w} className="flex gap-2 bg-amber-50 border border-amber-200 px-3 py-2 font-sans text-xs text-amber-800 leading-relaxed">
                  <AlertTriangle size={14} className="shrink-0 mt-0.5" /> {w}
                </li>
              ))}
            </ul>
          )}

          <dl className="grid grid-cols-[auto,1fr] gap-x-6 gap-y-1.5 font-sans text-xs">
            <dt className="text-gray-400">App credentials</dt>
            <dd className={status.configured ? 'text-gray-700' : 'text-red-500'}>{status.configured ? 'Set' : 'Missing'}</dd>
            <dt className="text-gray-400">Merchant entity</dt>
            <dd className="text-gray-700">{status.hasEntityId ? 'Set' : 'Falling back to App ID'}</dd>
            <dt className="text-gray-400">Links & callbacks use</dt>
            <dd className="text-gray-700 break-all">{status.origin || '—'}</dd>
          </dl>
        </>
      )}
    </div>
  )
}

export default function AdminSettingsPage() {
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [site, setSite] = useState<PlatformSettings>(SITE_CONTENT_DEFAULTS.platform_settings)

  useEffect(() => {
    getSiteContent('platform_settings').then(s => { setSite(s); setLoaded(true) })
  }, [])

  async function handleSave() {
    setSaving(true)
    try {
      await setSiteContent('platform_settings', site)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not save settings')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <p className="font-sans text-[10px] tracking-[0.14em] uppercase text-gray-400 mb-1">Admin Console</p>
          <h1 className="font-display italic text-3xl text-[#000000]">Platform Settings</h1>
        </div>
        <button
          onClick={handleSave}
          disabled={!loaded || saving}
          className={`inline-flex items-center gap-2 px-5 py-2.5 font-sans text-sm transition-colors disabled:opacity-50 ${saved ? 'bg-[#2d6a4f] text-white' : 'bg-[#C9A96E] text-[#1a1a1a] hover:bg-[#b8935e]'}`}
        >
          {saved ? <CheckCircle size={15} /> : <Save size={15} />}
          {saved ? 'Saved' : saving ? 'Saving…' : 'Save Settings'}
        </button>
      </div>

      <div className="max-w-2xl space-y-8">
        <BusinessDetailsCard />
        <TaxSettingsCard />
        <PaymentModeCard />

        {/* Integrations */}
        <Link href="/admin/settings/channels" className="block bg-white border border-gray-200 p-6 hover:border-[#2d6a4f] transition-colors group">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-[#2d6a4f]/10 flex items-center justify-center shrink-0">
                <MessageCircle size={18} className="text-[#2d6a4f]" />
              </div>
              <div>
                <h2 className="font-display italic text-xl">Channel Connections</h2>
                <p className="font-sans text-xs text-gray-400 mt-0.5">Connect WhatsApp Business, Messenger, Instagram, TikTok, email & SMS to the Communications Hub.</p>
              </div>
            </div>
            <ChevronRight size={18} className="text-gray-300 group-hover:text-[#2d6a4f] transition-colors" />
          </div>
        </Link>

        <div className="bg-white border border-gray-200 p-6">
          <h2 className="font-display italic text-xl mb-5">Site Identity</h2>
          <div className="space-y-4">
            {[
              { label: 'Site Name', key: 'site_name' },
              { label: 'Tagline', key: 'tagline' },
              { label: 'Contact Email', key: 'contact_email' },
              { label: 'Support Phone', key: 'support_phone' },
            ].map(f => (
              <div key={f.key}>
                <label className="block font-sans text-[10px] tracking-[0.12em] uppercase text-gray-400 mb-1.5">{f.label}</label>
                <input
                  value={(site as any)[f.key]}
                  onChange={e => setSite(s => ({ ...s, [f.key]: e.target.value }))}
                  className="w-full border border-gray-200 px-4 py-3 font-sans text-sm focus:outline-none focus:border-[#2d6a4f] bg-[#F7F5F2]"
                />
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white border border-gray-200 p-6">
          <h2 className="font-display italic text-xl mb-5">Business Rules</h2>
          <div className="space-y-4">
            <div>
              <label className="block font-sans text-[10px] tracking-[0.12em] uppercase text-gray-400 mb-1.5">Booking Commission (%)</label>
              <input
                type="number"
                value={site.booking_commission}
                onChange={e => setSite(s => ({ ...s, booking_commission: e.target.value }))}
                className="w-full border border-gray-200 px-4 py-3 font-sans text-sm focus:outline-none focus:border-[#2d6a4f] bg-[#F7F5F2]"
              />
              <p className="font-sans text-xs text-gray-400 mt-1">Platform fee deducted from each booking</p>
            </div>
            <div>
              <label className="block font-sans text-[10px] tracking-[0.12em] uppercase text-gray-400 mb-1.5">Loyalty Points per Rand Spent</label>
              <input
                type="number"
                value={site.loyalty_per_rand}
                onChange={e => setSite(s => ({ ...s, loyalty_per_rand: e.target.value }))}
                className="w-full border border-gray-200 px-4 py-3 font-sans text-sm focus:outline-none focus:border-[#2d6a4f] bg-[#F7F5F2]"
              />
            </div>
          </div>
        </div>

        <div className="bg-white border border-gray-200 p-6">
          <h2 className="font-display italic text-xl mb-5">Platform Behaviour</h2>
          <div className="space-y-4">
            {[
              { key: 'require_supplier_approval', label: 'Require admin approval for new suppliers', desc: 'Suppliers must be approved before they can publish listings.' },
              { key: 'auto_publish_listings', label: 'Auto-publish supplier listings', desc: 'Skip the pending state and publish listings immediately on creation.' },
              { key: 'maintenance_mode', label: 'Maintenance mode', desc: 'Takes the public site offline. Admin and supplier dashboards remain accessible.' },
            ].map(toggle => (
              <div key={toggle.key} className="flex items-start justify-between gap-6 py-3 border-b border-gray-100 last:border-0">
                <div>
                  <p className="font-sans text-sm font-medium text-gray-800">{toggle.label}</p>
                  <p className="font-sans text-xs text-gray-400 mt-0.5">{toggle.desc}</p>
                </div>
                <button
                  onClick={() => setSite(s => ({ ...s, [toggle.key]: !(s as any)[toggle.key] }))}
                  className={`shrink-0 w-11 h-6 transition-colors relative ${(site as any)[toggle.key] ? 'bg-[#2d6a4f]' : 'bg-gray-200'}`}
                >
                  <span className={`absolute top-1 w-4 h-4 bg-white transition-all ${(site as any)[toggle.key] ? 'left-6' : 'left-1'}`} />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
