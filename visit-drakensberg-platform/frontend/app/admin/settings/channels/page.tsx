'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  ArrowLeft, Check, Loader2, Link2, Unlink, Copy, ExternalLink, ShieldCheck,
  MessageSquare, Inbox, Phone, MessageCircle, Facebook, Instagram, Music2, Mail, Smartphone, AlertTriangle,
} from 'lucide-react'
import { CHANNEL_LIST, getChannel, type ChannelId } from '@/lib/channels'
import {
  CHANNEL_SETUP, getConnection, saveConnection, disconnectChannel, missingRequired,
  type ChannelConnectionRow,
} from '@/lib/channel-connections'

const ICONS: Record<string, any> = { MessageSquare, Inbox, Phone, MessageCircle, Facebook, Instagram, Music2, Mail, Smartphone }

function origin() {
  if (typeof window !== 'undefined') return process.env.NEXT_PUBLIC_SITE_URL || window.location.origin
  return process.env.NEXT_PUBLIC_SITE_URL || 'https://visitdrakensberg.com'
}

export default function ChannelConnectionsPage() {
  const configurable = CHANNEL_LIST.filter(c => CHANNEL_SETUP[c.id])
  const builtIn = CHANNEL_LIST.filter(c => !CHANNEL_SETUP[c.id])

  const [selected, setSelected] = useState<ChannelId>(configurable[0]?.id ?? 'whatsapp')
  const [conn, setConn] = useState<ChannelConnectionRow | null>(null)
  const [config, setConfig] = useState<Record<string, string>>({})
  const [secretInputs, setSecretInputs] = useState<Record<string, string>>({})
  const [statuses, setStatuses] = useState<Record<string, boolean>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState('')

  const setup = CHANNEL_SETUP[selected]!

  async function loadChannel(ch: ChannelId) {
    setLoading(true); setError(''); setSaved(false); setSecretInputs({})
    try {
      const row = await getConnection(ch)
      setConn(row)
      setConfig(row.config ?? {})
      setStatuses(s => ({ ...s, [ch]: row.connected }))
    } catch (e: any) { setError(e?.message || 'Could not load channel.') }
    setLoading(false)
  }
  useEffect(() => { loadChannel(selected) }, [selected])

  const secretPresent = useMemo(() => {
    const p: Record<string, boolean> = {}
    for (const f of setup.fields) if (f.secret) p[f.key] = Boolean(conn?.secret?.[f.key]) || Boolean(secretInputs[f.key]?.trim())
    return p
  }, [setup, conn, secretInputs])

  const missing = missingRequired(selected, config, secretPresent)

  async function save(connect: boolean) {
    setSaving(true); setError(''); setSaved(false)
    try {
      if (connect && missing.length) { setError(`Fill in: ${missing.join(', ')}`); setSaving(false); return }
      const row = await saveConnection(selected, config, secretInputs, connect)
      setConn(row); setSecretInputs({})
      setStatuses(s => ({ ...s, [selected]: connect }))
      setSaved(true); setTimeout(() => setSaved(false), 2000)
    } catch (e: any) {
      setError(e?.message?.includes('does not exist') || e?.code === '42P01'
        ? 'The channel connections table is missing. Run supabase/migrations/20260720_channel_connections.sql.'
        : (e?.message || 'Could not save.'))
    }
    setSaving(false)
  }

  async function disconnect() {
    setSaving(true); setError('')
    try { await disconnectChannel(selected); setConn(c => c ? { ...c, connected: false } : c); setStatuses(s => ({ ...s, [selected]: false })) }
    catch (e: any) { setError(e?.message || 'Could not disconnect.') }
    setSaving(false)
  }

  function copy(text: string, key: string) {
    navigator.clipboard.writeText(text).catch(() => {})
    setCopied(key); setTimeout(() => setCopied(''), 1500)
  }

  const webhookUrl = setup.webhookPath ? origin() + setup.webhookPath : ''
  const inputCls = 'w-full border border-gray-200 px-3 py-2.5 font-sans text-sm focus:outline-none focus:border-[#2d6a4f] bg-[#F7F5F2]'
  const labelCls = 'block font-sans text-[10px] tracking-[0.12em] uppercase text-gray-400 mb-1.5'

  return (
    <div className="p-8">
      <div className="mb-6">
        <Link href="/admin/settings" className="inline-flex items-center gap-1.5 font-sans text-xs text-gray-400 hover:text-[#2d6a4f] mb-3"><ArrowLeft size={13} /> Platform Settings</Link>
        <p className="font-sans text-[10px] tracking-[0.14em] uppercase text-gray-400 mb-1">Communications Hub</p>
        <h1 className="font-display italic text-3xl text-[#000000]">Channel Connections</h1>
        <p className="font-sans text-xs text-gray-400 mt-1">Connect your business messaging channels so their conversations flow into <Link href="/admin/messages" className="text-[#2d6a4f] underline">the Hub</Link>. Credentials are stored in an admin-only table, never on the public site.</p>
      </div>

      <div className="flex gap-6 items-start">
        {/* Channel list */}
        <div className="w-64 shrink-0 space-y-4">
          <div className="bg-white border border-gray-200">
            <p className="px-4 pt-3 pb-1 font-sans text-[10px] tracking-[0.12em] uppercase text-gray-400">Configurable</p>
            {configurable.map(ch => {
              const Icon = ICONS[ch.icon] ?? MessageSquare
              const on = statuses[ch.id] ?? (ch.id === conn?.channel ? conn?.connected : false)
              return (
                <button key={ch.id} onClick={() => setSelected(ch.id)}
                  className={`w-full flex items-center gap-2.5 px-4 py-2.5 border-t border-gray-100 transition-colors ${selected === ch.id ? 'bg-[#2d6a4f]/5' : 'hover:bg-[#F7F5F2]'}`}>
                  <Icon size={15} style={{ color: ch.color }} />
                  <span className="flex-1 text-left font-sans text-sm text-gray-700">{ch.label}</span>
                  <span className={`w-2 h-2 rounded-full ${on ? 'bg-[#2d6a4f]' : 'bg-gray-300'}`} title={on ? 'Connected' : 'Not connected'} />
                </button>
              )
            })}
          </div>
          <div className="bg-white border border-gray-200">
            <p className="px-4 pt-3 pb-1 font-sans text-[10px] tracking-[0.12em] uppercase text-gray-400">Built-in (no setup)</p>
            {builtIn.map(ch => {
              const Icon = ICONS[ch.icon] ?? MessageSquare
              return (
                <div key={ch.id} className="flex items-center gap-2.5 px-4 py-2.5 border-t border-gray-100">
                  <Icon size={15} style={{ color: ch.color }} />
                  <span className="flex-1 font-sans text-sm text-gray-600">{ch.label}</span>
                  <span className="font-sans text-[10px] text-[#2d6a4f] flex items-center gap-1"><Check size={11} /> Active</span>
                </div>
              )
            })}
          </div>
        </div>

        {/* Editor */}
        <div className="flex-1 bg-white border border-gray-200 p-6 max-w-2xl">
          {loading ? (
            <div className="py-16 flex justify-center"><Loader2 className="w-5 h-5 text-gray-300 animate-spin" /></div>
          ) : (
            <>
              <div className="flex items-center justify-between mb-1">
                <h2 className="font-display italic text-xl flex items-center gap-2">
                  {(() => { const Icon = ICONS[getChannel(selected).icon] ?? MessageSquare; return <Icon size={18} style={{ color: getChannel(selected).color }} /> })()}
                  {getChannel(selected).label}
                </h2>
                <span className={`font-sans text-xs px-2.5 py-1 ${conn?.connected ? 'bg-[#2d6a4f]/10 text-[#2d6a4f]' : 'bg-gray-100 text-gray-500'}`}>
                  {conn?.connected ? 'Connected' : 'Not connected'}
                </span>
              </div>
              {setup.docsNote && <p className="font-sans text-xs text-gray-500 leading-relaxed mb-4">{setup.docsNote}{setup.docsUrl && <> <a href={setup.docsUrl} target="_blank" rel="noopener noreferrer" className="text-[#2d6a4f] inline-flex items-center gap-0.5 underline">Provider docs <ExternalLink size={10} /></a></>}</p>}

              {!setup.canSend && (
                <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 px-3 py-2 mb-4">
                  <AlertTriangle size={14} className="text-amber-500 mt-0.5 shrink-0" />
                  <p className="font-sans text-xs text-amber-700">Outbound delivery for this channel isn’t live yet — you can still store credentials so it’s ready to switch on.</p>
                </div>
              )}

              {error && <p className="font-sans text-sm text-red-500 mb-4">{error}</p>}

              <div className="space-y-4">
                {setup.fields.map(f => (
                  <div key={f.key}>
                    <label className={labelCls}>{f.label}{f.secret && <ShieldCheck size={11} className="inline ml-1 text-gray-300" />}</label>
                    {f.secret ? (
                      <input
                        type="password"
                        value={secretInputs[f.key] ?? ''}
                        onChange={e => setSecretInputs(s => ({ ...s, [f.key]: e.target.value }))}
                        placeholder={conn?.secret?.[f.key] ? '•••••••••• (saved — leave blank to keep)' : (f.placeholder || '')}
                        className={inputCls}
                      />
                    ) : (
                      <input
                        value={config[f.key] ?? ''}
                        onChange={e => setConfig(c => ({ ...c, [f.key]: e.target.value }))}
                        placeholder={f.placeholder}
                        className={inputCls}
                      />
                    )}
                    {f.help && <p className="font-sans text-[11px] text-gray-400 mt-1">{f.help}</p>}
                  </div>
                ))}
              </div>

              {/* Webhook details for inbound */}
              {webhookUrl && (
                <div className="mt-6 pt-5 border-t border-gray-100">
                  <p className="font-sans text-[10px] tracking-[0.12em] uppercase text-gray-400 mb-2">Inbound webhook</p>
                  <p className="font-sans text-xs text-gray-500 mb-2">Register this callback URL in the provider console (with your Verify Token above) so customer replies flow back in.</p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 bg-[#F7F5F2] border border-gray-200 px-3 py-2 font-mono text-xs text-gray-700 truncate">{webhookUrl}</code>
                    <button onClick={() => copy(webhookUrl, 'wh')} className="p-2 border border-gray-200 text-gray-500 hover:text-[#2d6a4f]">
                      {copied === 'wh' ? <Check size={14} /> : <Copy size={14} />}
                    </button>
                  </div>
                  <p className="font-sans text-[11px] text-gray-400 mt-2">Note: the inbound receiver endpoint is scaffolded but not yet deployed — outbound sending works once connected; inbound delivery is the remaining step.</p>
                </div>
              )}

              {/* Actions */}
              <div className="mt-6 pt-5 border-t border-gray-100 flex items-center gap-3">
                {conn?.connected ? (
                  <>
                    <button onClick={() => save(true)} disabled={saving} className="inline-flex items-center gap-2 bg-[#2d6a4f] text-white px-5 py-2.5 font-sans text-sm disabled:opacity-50">
                      {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Save changes
                    </button>
                    <button onClick={disconnect} disabled={saving} className="inline-flex items-center gap-2 border border-gray-200 text-gray-600 px-4 py-2.5 font-sans text-sm hover:border-red-300 hover:text-red-500">
                      <Unlink size={14} /> Disconnect
                    </button>
                  </>
                ) : (
                  <>
                    <button onClick={() => save(true)} disabled={saving} className="inline-flex items-center gap-2 bg-[#C9A96E] text-[#1a1a1a] px-5 py-2.5 font-sans text-sm font-semibold disabled:opacity-50">
                      {saving ? <Loader2 size={14} className="animate-spin" /> : <Link2 size={14} />} Connect channel
                    </button>
                    <button onClick={() => save(false)} disabled={saving} className="inline-flex items-center gap-2 border border-gray-200 text-gray-600 px-4 py-2.5 font-sans text-sm">
                      Save without connecting
                    </button>
                  </>
                )}
                {saved && <span className="font-sans text-sm text-[#2d6a4f] flex items-center gap-1"><Check size={15} /> Saved</span>}
                {missing.length > 0 && !conn?.connected && <span className="font-sans text-[11px] text-gray-400">Missing: {missing.join(', ')}</span>}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
