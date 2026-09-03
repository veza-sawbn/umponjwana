'use client'

import { useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { formatMoney } from '@/lib/allocation'
import {
  Search, ShieldCheck, XCircle, ChevronDown, ChevronUp, RefreshCw,
  Mail, Phone, Building2, MapPin, Image as ImageIcon, ExternalLink,
} from 'lucide-react'
import {
  getListingApplications, tierById, APPLICANT_TYPES,
  type ListingApplication, type ListingApplicationStatus, type ApplicationActivity,
} from '@/lib/listing-applications'
import CompliancePanel from '@/components/admin/CompliancePanel'

// Review queue for the public "list with us" journey (app/list-with-us).
// Every submission lands in vd_listing_applications, invisible to visitors
// and unreadable by anyone but an admin — this page is the only place they
// become visible at all. Deciding "approved" calls
// /api/admin/listing-applications/[id]/decide, which is where the actual
// account creation/approval and commission-terms writes happen (they need
// the service role — is_approved is outside the authenticated column grant,
// same reason app/api/admin/supplier/[id]/route.ts exists).

const STATUS_LABEL: Record<ListingApplicationStatus, string> = {
  new: 'New', in_review: 'In review', approved: 'Approved', declined: 'Declined',
}
const STATUS_STYLE: Record<ListingApplicationStatus, string> = {
  new: 'bg-[#C9A96E]/15 text-[#8B6914]',
  in_review: 'bg-blue-50 text-blue-600',
  approved: 'bg-[#2d6a4f]/10 text-[#2d6a4f]',
  declined: 'bg-red-50 text-red-500',
}
const STATUS_FILTERS: ('all' | ListingApplicationStatus)[] = ['all', 'new', 'in_review', 'approved', 'declined']

const typeLabel = (id: string) => APPLICANT_TYPES.find(t => t.id === id)?.label ?? id

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="font-sans text-[10px] tracking-[0.12em] uppercase text-gray-400 mb-0.5">{label}</p>
      <div className="font-sans text-sm text-gray-700 leading-relaxed">{children}</div>
    </div>
  )
}

function ActivityCard({ a }: { a: ApplicationActivity }) {
  const bits = [a.category, a.difficulty, a.durationHours && `${a.durationHours}h`, a.maxGroup && `up to ${a.maxGroup}`,
    a.minAge && `${a.minAge}+`, a.pricePerPerson && `${formatMoney(Number(a.pricePerPerson))} pp`].filter(Boolean)
  return (
    <div className="border border-gray-100 px-3 py-2.5">
      <p className="font-sans text-sm font-medium text-gray-800">{a.name}</p>
      <p className="font-sans text-xs text-gray-400 mt-0.5">{bits.join(' · ') || '—'}</p>
      {a.included.length > 0 && <p className="font-sans text-xs text-gray-500 mt-1">Includes: {a.included.join(', ')}</p>}
      {a.description && <p className="font-sans text-xs text-gray-500 mt-1 leading-relaxed">{a.description}</p>}
    </div>
  )
}

function ApplicationDetail({ app }: { app: ListingApplication }) {
  const tier = tierById(app.commissionTier)
  return (
    <div className="px-6 py-5 space-y-5 bg-[#F7F5F2]">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-x-6 gap-y-4">
        <Field label="Contact">
          <p>{app.contactName}{app.contactRole ? ` — ${app.contactRole}` : ''}</p>
          <p className="flex items-center gap-1.5 text-gray-500 mt-0.5"><Mail size={11} /> {app.contactEmail}</p>
          {app.contactPhone && <p className="flex items-center gap-1.5 text-gray-500 mt-0.5"><Phone size={11} /> {app.contactPhone}</p>}
        </Field>
        <Field label="Business">
          <p className="flex items-center gap-1.5"><Building2 size={11} /> {app.businessName}</p>
          {app.tradingName && app.tradingName !== app.businessName && <p className="text-gray-500 mt-0.5">Trading as {app.tradingName}</p>}
        </Field>
        <Field label="Region">
          <p className="flex items-center gap-1.5"><MapPin size={11} /> {[app.region, app.baseTown].filter(Boolean).join(' · ') || '—'}</p>
        </Field>
      </div>

      <Field label="Operates">
        <div className="flex flex-wrap gap-1.5 mt-1">
          {app.supplierTypes.map(t => (
            <span key={t} className="font-sans text-xs px-2 py-1 bg-white border border-gray-200">{typeLabel(t)}</span>
          ))}
        </div>
      </Field>

      {app.description && <Field label="Description"><p className="whitespace-pre-line">{app.description}</p></Field>}

      {app.photos.length > 0 && (
        <Field label={`Photos (${app.photos.length})`}>
          <div className="flex flex-wrap gap-2 mt-1">
            {app.photos.map((url, i) => (
              <a key={url} href={url} target="_blank" rel="noreferrer"
                className="relative block w-24 h-16 overflow-hidden border border-gray-200 bg-gray-50">
                <img src={url} alt="" className="w-full h-full object-cover"
                  onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
                {i === 0 && <span className="absolute bottom-0 inset-x-0 bg-black/60 text-white text-[9px] text-center py-0.5">Cover</span>}
              </a>
            ))}
          </div>
        </Field>
      )}
      {app.photos.length === 0 && (
        <p className="font-sans text-xs text-gray-400 flex items-center gap-1.5"><ImageIcon size={12} /> No photos submitted.</p>
      )}

      {app.supplierTypes.includes('Accommodation') && (
        <div className="bg-white border border-gray-200 p-4">
          <p className="font-sans text-xs font-semibold text-gray-700 mb-3">Property</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3">
            <Field label="Name"><p>{app.stay.propertyName || '—'}</p></Field>
            <Field label="Type / rooms">
              <p>{[app.stay.propertyType, app.stay.roomCount && `${app.stay.roomCount} rooms`, app.stay.elevation && `${app.stay.elevation} m`].filter(Boolean).join(' · ') || '—'}</p>
            </Field>
            <Field label="Amenities"><p>{app.stay.amenities.join(', ') || '—'}</p></Field>
          </div>
        </div>
      )}

      {app.supplierTypes.includes('Guided Tours') && (
        <div className="bg-white border border-gray-200 p-4">
          <p className="font-sans text-xs font-semibold text-gray-700 mb-3">Tours</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3">
            <Field label="Style / length / guides">
              <p>{[app.tour.tourStyle, app.tour.typicalDurationDays && `${app.tour.typicalDurationDays} days`, app.tour.guideCount && `${app.tour.guideCount} guides`].filter(Boolean).join(' · ') || '—'}</p>
            </Field>
            <Field label="Certifications"><p>{app.tour.certifications || '—'}</p></Field>
          </div>
        </div>
      )}

      {app.supplierTypes.includes('Shuttle') && (
        <div className="bg-white border border-gray-200 p-4">
          <p className="font-sans text-xs font-semibold text-gray-700 mb-3">Transport</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3">
            <Field label="Fleet">
              <p>{[app.shuttle.fleetSize && `${app.shuttle.fleetSize} vehicles`, app.shuttle.vehicleTypes.join(', '), app.shuttle.operatingLicence].filter(Boolean).join(' · ') || '—'}</p>
            </Field>
            <Field label="Routes served"><p className="whitespace-pre-line">{app.shuttle.routesServed || '—'}</p></Field>
          </div>
        </div>
      )}

      {app.supplierTypes.includes('Experience') && (
        <div className="bg-white border border-gray-200 p-4">
          <p className="font-sans text-xs font-semibold text-gray-700 mb-3">Experience</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3">
            <Field label="What they host"><p>{app.experience.experienceStyle || '—'}</p></Field>
            <Field label="Group / duration / setting">
              <p>{[app.experience.typicalGroupSize && `groups of ${app.experience.typicalGroupSize}`, app.experience.durationHours && `${app.experience.durationHours}h`, app.experience.setting].filter(Boolean).join(' · ') || '—'}</p>
            </Field>
          </div>
        </div>
      )}

      {app.activities.length > 0 && (
        <div>
          <p className="font-sans text-xs font-semibold text-gray-700 mb-2">
            Activities {app.offersActivities && !app.supplierTypes.includes('Activity') ? '(add-on)' : ''}
          </p>
          <div className="space-y-2">{app.activities.map((a, i) => <ActivityCard key={i} a={a} />)}</div>
        </div>
      )}

      <div className="bg-white border border-gray-200 p-4 flex items-center justify-between flex-wrap gap-3">
        <div>
          <p className="font-sans text-xs font-semibold text-gray-700">Commission tier requested</p>
          <p className="font-sans text-sm text-gray-600 mt-0.5">
            {tier.name} — <span className="text-[#2d6a4f] font-medium">{tier.rate}%</span> total platform fee
            {app.commissionAcknowledged ? '' : ' (terms not acknowledged)'}
          </p>
        </div>
        <span className="font-sans text-[10px] tracking-[0.08em] uppercase text-gray-400">Ref {app.reference}</span>
      </div>
    </div>
  )
}

function DecisionButtons({ status, busy, accreditationOk, onDecide }: {
  status: ListingApplicationStatus
  busy: boolean
  /** From CompliancePanel. Approval is blocked until this is true. */
  accreditationOk: boolean
  onDecide: (d: 'in_review' | 'approved' | 'declined') => void
}) {
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {status !== 'in_review' && status !== 'approved' && (
        <button disabled={busy} onClick={() => onDecide('in_review')}
          className="px-2.5 py-1 border border-blue-200 text-blue-600 font-sans text-xs hover:bg-blue-50 transition-colors flex items-center gap-1 disabled:opacity-50">
          <RefreshCw size={11} /> Mark in review
        </button>
      )}
      {status !== 'approved' && (
        // Disabled rather than hidden, with the reason on hover: a reviewer
        // who cannot find the Approve button files a bug; one who can see why
        // it is greyed out goes and verifies the certificate. The API route
        // enforces the same rule, so this is a signpost, not the gate.
        <button
          disabled={busy || !accreditationOk}
          onClick={() => onDecide('approved')}
          title={accreditationOk ? undefined : 'Verify an EDTEA registration or CTO membership first'}
          className="px-2.5 py-1 bg-[#2d6a4f] text-white font-sans text-xs hover:bg-[#235a3f] transition-colors flex items-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-[#2d6a4f]">
          <ShieldCheck size={11} /> Approve
        </button>
      )}
      {status !== 'declined' && status !== 'approved' && (
        <button disabled={busy} onClick={() => onDecide('declined')}
          className="px-2.5 py-1 border border-red-200 text-red-500 font-sans text-xs hover:bg-red-50 transition-colors flex items-center gap-1 disabled:opacity-50">
          <XCircle size={11} /> Decline
        </button>
      )}
    </div>
  )
}

export default function AdminListingApplicationsPage() {
  const [applications, setApplications] = useState<ListingApplication[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<'all' | ListingApplicationStatus>('all')
  const [search, setSearch] = useState('')
  const [expanded, setExpanded] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  // Accreditation verdict per application reference, reported up by the
  // CompliancePanel of whichever row is open. Keyed rather than a single
  // value so collapsing and reopening a row doesn't briefly re-enable
  // Approve against a stale verdict.
  const [accreditation, setAccreditation] = useState<Record<string, boolean>>({})

  async function load() {
    setLoading(true)
    try {
      setApplications(await getListingApplications())
    } catch {
      toast.error('Could not load listing applications.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const visible = useMemo(() => applications.filter(a =>
    (statusFilter === 'all' || a.status === statusFilter) &&
    `${a.businessName} ${a.tradingName} ${a.contactName} ${a.contactEmail} ${a.region}`.toLowerCase().includes(search.toLowerCase()),
  ), [applications, statusFilter, search])

  const countFor = (f: 'all' | ListingApplicationStatus) =>
    applications.filter(a => f === 'all' || a.status === f).length

  async function decide(app: ListingApplication, decision: 'in_review' | 'approved' | 'declined') {
    setBusyId(app.id)
    try {
      const res = await fetch(`/api/admin/listing-applications/${app.id}/decide`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || 'Decision failed.')

      setApplications(list => list.map(a => a.id === app.id ? { ...a, status: decision } : a))

      if (decision === 'approved') {
        toast.success(data.created ? 'Approved — supplier account created and invited.' : 'Approved — existing account granted access.')
        if (Array.isArray(data.warnings) && data.warnings.length > 0) {
          data.warnings.forEach((w: string) => toast(w, { icon: '⚠️' }))
        }
      } else {
        toast.success(decision === 'declined' ? 'Application declined.' : 'Marked in review.')
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not update the application.')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="p-8">
      <div className="mb-8 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="font-sans text-[10px] tracking-[0.14em] uppercase text-gray-400 mb-1">Admin Console</p>
          <h1 className="font-display italic text-3xl text-[#000000]">Listing Applications</h1>
          <p className="font-sans text-sm text-gray-500 mt-1">Submissions from /list-with-us — approve to create or unlock a supplier account.</p>
        </div>
        <button onClick={load} className="font-sans text-xs text-[#2d6a4f] hover:underline flex items-center gap-1.5">
          <RefreshCw size={12} /> Refresh
        </button>
      </div>

      <div className="flex items-center gap-4 mb-4 flex-wrap">
        <div className="flex items-center gap-1 flex-wrap">
          {STATUS_FILTERS.map(f => (
            <button key={f} onClick={() => setStatusFilter(f)}
              className={`px-3 py-1.5 font-sans text-xs transition-colors ${statusFilter === f ? 'bg-[#000000] text-white' : 'bg-white border border-gray-200 text-gray-500 hover:border-gray-400'}`}>
              {f === 'all' ? 'All' : STATUS_LABEL[f]} <span className="text-gray-400 ml-1">{countFor(f)}</span>
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 border border-gray-200 bg-white px-3 py-1.5 ml-auto">
          <Search size={13} className="text-gray-300" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search business, contact, region…"
            className="font-sans text-xs outline-none w-56" />
        </div>
      </div>

      <div className="bg-white border border-gray-200">
        {loading && <div className="px-6 py-16 text-center font-sans text-sm text-gray-400">Loading…</div>}

        {!loading && visible.length === 0 && (
          <div className="px-6 py-16 text-center">
            <ShieldCheck size={24} className="text-gray-300 mx-auto mb-2" />
            <p className="font-sans text-sm text-gray-400">
              {applications.length === 0 ? 'No applications yet.' : 'No applications match this filter.'}
            </p>
          </div>
        )}

        <div className="divide-y divide-gray-100">
          {visible.map(app => {
            const isOpen = expanded === app.id
            const busy = busyId === app.id
            return (
              <div key={app.id}>
                <button
                  onClick={() => setExpanded(isOpen ? null : app.id)}
                  className="w-full px-6 py-4 flex items-center gap-4 text-left hover:bg-[#F7F5F2]/60 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                      <p className="font-sans text-sm font-medium truncate">{app.tradingName || app.businessName}</p>
                      <span className={`inline-flex px-2 py-0.5 font-sans text-[10px] uppercase tracking-wide ${STATUS_STYLE[app.status]}`}>
                        {STATUS_LABEL[app.status]}
                      </span>
                    </div>
                    <p className="font-sans text-xs text-gray-400 truncate">
                      {app.contactEmail} · {app.supplierTypes.map(typeLabel).join(', ') || 'No type selected'} · {app.region || 'No region'}
                    </p>
                  </div>
                  <span className="font-sans text-xs text-gray-400 shrink-0 hidden sm:block">
                    {new Date(app.createdAt).toLocaleDateString()}
                  </span>
                  {isOpen ? <ChevronUp size={16} className="text-gray-400 shrink-0" /> : <ChevronDown size={16} className="text-gray-400 shrink-0" />}
                </button>

                {isOpen && (
                  <>
                    <ApplicationDetail app={app} />
                    <div className="px-6 pb-5 bg-[#F7F5F2]/40">
                      {/* supplierId matters once approved: approval moves the
                          certificates onto the account, so without it the panel
                          would show an approved operator as having no
                          accreditation at all. */}
                      <CompliancePanel
                        applicationRef={app.reference}
                        supplierId={app.supplierId}
                        onAccreditationChange={ok => setAccreditation(a => (a[app.reference] === ok ? a : { ...a, [app.reference]: ok }))}
                      />
                    </div>
                    <div className="px-6 py-3 border-t border-gray-100 flex items-center justify-between flex-wrap gap-3">
                      <a href={`mailto:${app.contactEmail}`} className="font-sans text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1.5">
                        <ExternalLink size={11} /> Email applicant
                      </a>
                      <DecisionButtons
                        status={app.status}
                        busy={busy}
                        accreditationOk={accreditation[app.reference] ?? false}
                        onDecide={d => decide(app, d)}
                      />
                    </div>
                  </>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
