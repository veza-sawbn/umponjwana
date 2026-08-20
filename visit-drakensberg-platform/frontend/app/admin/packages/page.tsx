'use client'

import { useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import {
  Package, Plus, Pencil, Copy, Archive, Eye, EyeOff, Star, X, Trash2,
  CalendarClock, Users, ChevronDown, ChevronUp,
} from 'lucide-react'
import { supabase } from '@/lib/auth'
import {
  getPackages, addPackage, updatePackage, duplicatePackage, deletePackage,
  setPackageStatus, packageTotals, componentMargin,
  PACKAGE_STATUS_LABELS, COMPONENT_TYPE_LABELS, PACKAGE_CATEGORIES, PACKAGE_CATEGORY_LABELS,
  GALLERY_COMPONENT_TYPES,
  type MarketplacePackage, type PackageComponent, type PackageComponentType, type PackageStatus,
} from '@/lib/packages'
import { getAdminSuppliers, adminMediaSource, type AdminSupplier } from '@/lib/admin-supabase'
import { getTrails, type Trail } from '@/lib/trails'
import { MediaPicker, MediaGalleryPicker } from '@/components/media/MediaPicker'
import { SeoPanel } from '@/components/admin/SeoPanel'

// Admin Package Builder: packages are curated by Visit Drakensberg from
// services supplied by multiple businesses. Each component keeps its own
// supplier relationship, cost/sell pricing and rules; suppliers only ever
// receive the fulfilment record for their assigned service.

const inputCls = 'w-full border border-gray-200 px-3 py-2.5 font-sans text-sm focus:outline-none focus:border-[#2d6a4f] bg-[#F7F5F2]'
const labelCls = 'block font-sans text-[10px] tracking-[0.12em] uppercase text-gray-400 mb-1.5'

const STATUS_STYLE: Record<PackageStatus, string> = {
  draft: 'bg-gray-100 text-gray-500',
  supplier_review: 'bg-amber-50 text-amber-700',
  pending_confirmation: 'bg-amber-50 text-amber-700',
  ready_for_sale: 'bg-blue-50 text-blue-700',
  published: 'bg-emerald-50 text-emerald-700',
  booked: 'bg-[#C9A96E]/15 text-[#8B6914]',
  in_progress: 'bg-blue-50 text-blue-700',
  completed: 'bg-emerald-50 text-emerald-700',
  cancelled: 'bg-red-50 text-red-600',
  archived: 'bg-gray-100 text-gray-400',
}

type Draft = Omit<MarketplacePackage, 'id' | 'status' | 'createdAt' | 'updatedAt'>

const EMPTY_DRAFT: Draft = {
  title: '', summary: '', description: '', image: '', region: '',
  durationNights: 2, maxGuests: 8, pricePerPerson: 0, originalPrice: undefined,
  tag: '', featured: false, categories: [], trailIds: [], components: [],
  packageStatus: 'draft', publishFrom: '', publishTo: '',
}

const EMPTY_COMPONENT: Omit<PackageComponent, 'id'> = {
  type: 'accommodation', title: '', supplierId: '', supplierName: '', supplierContact: '',
  costPrice: 0, sellingPrice: 0, commissionPct: 10, availability: '',
  bookingRules: '', cancellationRules: '', notes: '', trailId: '', gallery: [],
}

function ComponentEditor({
  component, suppliers, trails, onChange, onRemove,
}: {
  component: PackageComponent
  suppliers: AdminSupplier[]
  trails: Trail[]
  onChange: (c: PackageComponent) => void
  onRemove: () => void
}) {
  const showGallery = GALLERY_COMPONENT_TYPES.includes(component.type)
  const [open, setOpen] = useState(!component.title)
  const set = (k: keyof PackageComponent, v: unknown) => onChange({ ...component, [k]: v })

  return (
    <div className="border border-gray-200 bg-white">
      <div className="flex items-center justify-between gap-3 px-4 py-3">
        <button onClick={() => setOpen(v => !v)} className="flex items-center gap-2 text-left flex-1 min-w-0">
          {open ? <ChevronUp size={14} className="text-gray-400 shrink-0" /> : <ChevronDown size={14} className="text-gray-400 shrink-0" />}
          <span className="font-sans text-[10px] tracking-[0.1em] uppercase text-[#C9A96E] shrink-0">{COMPONENT_TYPE_LABELS[component.type]}</span>
          <span className="font-sans text-sm truncate">{component.title || 'Untitled component'}</span>
          {component.supplierName && <span className="font-sans text-xs text-gray-400 truncate">· {component.supplierName}</span>}
        </button>
        <div className="flex items-center gap-3 shrink-0">
          <span className="font-sans text-xs text-gray-500">
            R{component.costPrice.toLocaleString()} → R{component.sellingPrice.toLocaleString()}
            <span className={componentMargin(component) >= 0 ? 'text-emerald-600' : 'text-red-500'}> ({componentMargin(component) >= 0 ? '+' : ''}R{componentMargin(component).toLocaleString()})</span>
          </span>
          <button onClick={onRemove} className="text-gray-300 hover:text-red-400 transition-colors"><Trash2 size={14} /></button>
        </div>
      </div>

      {open && (
        <div className="border-t border-gray-100 p-4 grid grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <label className={labelCls}>Component Type</label>
            <select value={component.type} onChange={e => set('type', e.target.value as PackageComponentType)} className={inputCls}>
              {Object.entries(COMPONENT_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div className={component.type === 'trail' ? '' : 'lg:col-span-2'}>
            <label className={labelCls}>Service Title</label>
            <input value={component.title} onChange={e => set('title', e.target.value)} placeholder="e.g. 2 nights — Mountain View Lodge" className={inputCls} />
          </div>
          {component.type === 'trail' && (
            <div>
              <label className={labelCls}>Hiking Trail</label>
              <select
                value={component.trailId ?? ''}
                onChange={e => {
                  const t = trails.find(x => x.id === e.target.value)
                  onChange({ ...component, trailId: e.target.value, title: component.title || (t ? t.name : '') })
                }}
                className={inputCls}
              >
                <option value="">Select trail…</option>
                {trails.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
          )}
          <div>
            <label className={labelCls}>Supplier</label>
            <select
              value={component.supplierId}
              onChange={e => {
                const s = suppliers.find(x => x.id === e.target.value)
                onChange({ ...component, supplierId: e.target.value, supplierName: s?.business_name ?? component.supplierName, supplierContact: component.supplierContact || s?.email || '' })
              }}
              className={inputCls}
            >
              <option value="">Manual / internal</option>
              {suppliers.map(s => <option key={s.id} value={s.id}>{s.business_name || s.email || s.id.slice(0, 8)}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>Supplier Name</label>
            <input value={component.supplierName} onChange={e => set('supplierName', e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Supplier Contact</label>
            <input value={component.supplierContact} onChange={e => set('supplierContact', e.target.value)} placeholder="email / phone" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Cost Price (R)</label>
            <input type="number" value={component.costPrice || ''} onChange={e => set('costPrice', +e.target.value || 0)} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Selling Price (R)</label>
            <input type="number" value={component.sellingPrice || ''} onChange={e => set('sellingPrice', +e.target.value || 0)} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Commission (%)</label>
            <input type="number" value={component.commissionPct || ''} onChange={e => set('commissionPct', +e.target.value || 0)} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Availability</label>
            <input value={component.availability} onChange={e => set('availability', e.target.value)} placeholder="e.g. Daily except Sundays" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Booking Rules</label>
            <input value={component.bookingRules} onChange={e => set('bookingRules', e.target.value)} placeholder="e.g. Book 72h ahead" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Cancellation Rules</label>
            <input value={component.cancellationRules} onChange={e => set('cancellationRules', e.target.value)} placeholder="e.g. Free until 7 days before" className={inputCls} />
          </div>
          <div className="col-span-2 lg:col-span-3">
            <label className={labelCls}>Operational Notes (sent to the supplier with the booking)</label>
            <input value={component.notes} onChange={e => set('notes', e.target.value)} className={inputCls} />
          </div>
          {showGallery && (
            <div className="col-span-2 lg:col-span-3">
              <label className={labelCls}>Gallery Images (shown on the public package page)</label>
              <MediaGalleryPicker value={component.gallery ?? []} onChange={urls => set('gallery', urls)} source={adminMediaSource} />
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function AdminPackagesPage() {
  const [packages, setPackages] = useState<MarketplacePackage[]>([])
  const [suppliers, setSuppliers] = useState<AdminSupplier[]>([])
  const [trails, setTrails] = useState<Trail[]>([])
  const [adminId, setAdminId] = useState('')
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<string | 'new' | null>(null)
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT)
  const [saving, setSaving] = useState(false)
  const [showArchived, setShowArchived] = useState(false)
  const set = (k: keyof Draft, v: unknown) => setDraft(d => ({ ...d, [k]: v }))

  useEffect(() => {
    Promise.all([
      getPackages(),
      getAdminSuppliers(),
      getTrails(),
      supabase.auth.getUser(),
    ]).then(([pkgs, sups, trls, { data: { user } }]) => {
      setPackages(pkgs)
      setSuppliers(sups.filter(s => s.role !== 'visitor'))
      setTrails(trls.filter(t => t.status === 'published'))
      setAdminId(user?.id ?? '')
      setLoading(false)
    })
  }, [])

  const totals = useMemo(() => packageTotals({ ...draft, id: '', status: 'draft', createdAt: '' } as MarketplacePackage), [draft])

  function startNew() {
    setDraft(EMPTY_DRAFT)
    setEditing('new')
  }

  function startEdit(p: MarketplacePackage) {
    const { id: _i, status: _s, createdAt: _c, updatedAt: _u, supplierId: _o, ...rest } = p
    setDraft({ ...EMPTY_DRAFT, ...rest })
    setEditing(p.id)
  }

  async function save() {
    if (!draft.title.trim()) { toast.error('Package title is required.'); return }
    setSaving(true)
    try {
      if (editing === 'new') {
        const created = await addPackage(draft, adminId)
        setPackages(ps => [created, ...ps])
        toast.success('Package created.')
      } else if (editing) {
        await updatePackage(editing, draft)
        setPackages(ps => ps.map(p => (p.id === editing ? { ...p, ...draft, status: draft.packageStatus === 'published' ? 'active' : 'draft' } : p)))
        toast.success('Package saved.')
      }
      setEditing(null)
    } catch {
      toast.error('Could not save the package.')
    } finally {
      setSaving(false)
    }
  }

  async function transition(p: MarketplacePackage, status: PackageStatus, message: string) {
    try {
      await setPackageStatus(p.id, status)
      setPackages(ps => ps.map(x => (x.id === p.id ? { ...x, packageStatus: status, status: status === 'published' ? 'active' : 'draft' } : x)))
      toast.success(message)
    } catch { toast.error('Could not update the package.') }
  }

  async function toggleFeature(p: MarketplacePackage) {
    try {
      await updatePackage(p.id, { featured: !p.featured })
      setPackages(ps => ps.map(x => (x.id === p.id ? { ...x, featured: !p.featured } : x)))
      toast.success(p.featured ? 'Removed from featured.' : 'Package featured.')
    } catch { toast.error('Could not update the package.') }
  }

  async function duplicate(p: MarketplacePackage) {
    try {
      const copy = await duplicatePackage(p.id, adminId)
      if (copy) { setPackages(ps => [copy, ...ps]); toast.success('Package duplicated as draft.') }
    } catch { toast.error('Could not duplicate the package.') }
  }

  async function remove(p: MarketplacePackage) {
    const prev = packages
    setPackages(ps => ps.filter(x => x.id !== p.id))
    try {
      await deletePackage(p.id)
      toast.success('Package deleted.')
    } catch {
      setPackages(prev)
      toast.error('Could not delete the package.')
    }
  }

  const visible = packages.filter(p => showArchived || p.packageStatus !== 'archived')

  if (editing !== null) {
    return (
      <div className="p-8 max-w-4xl">
        <div className="flex items-center justify-between mb-6">
          <h1 className="font-display italic text-3xl text-[#000000]">
            {editing === 'new' ? 'Create Package' : 'Edit Package'}
          </h1>
          <button onClick={() => setEditing(null)} className="text-gray-400 hover:text-black transition-colors"><X size={20} /></button>
        </div>

        <div className="space-y-6">
          <div className="bg-white border border-gray-200 p-6 space-y-4">
            <h2 className="font-display italic text-xl">Package Details</h2>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className={labelCls}>Title</label>
                <input value={draft.title} onChange={e => set('title', e.target.value)} className={inputCls} />
              </div>
              <div className="col-span-2">
                <label className={labelCls}>Summary (card text)</label>
                <input value={draft.summary} onChange={e => set('summary', e.target.value)} className={inputCls} />
              </div>
              <div className="col-span-2">
                <label className={labelCls}>Description</label>
                <textarea rows={4} value={draft.description} onChange={e => set('description', e.target.value)} className={`${inputCls} resize-none`} />
              </div>
              <div>
                <label className={labelCls}>Hero Image</label>
                <MediaPicker value={draft.image} onChange={url => set('image', url)} source={adminMediaSource} />
              </div>
              <div>
                <label className={labelCls}>Region</label>
                <input value={draft.region} onChange={e => set('region', e.target.value)} placeholder="e.g. Royal Natal" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Duration (nights)</label>
                <input type="number" min={0} value={draft.durationNights} onChange={e => set('durationNights', Math.max(0, +e.target.value))} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Max Guests</label>
                <input type="number" min={1} value={draft.maxGuests} onChange={e => set('maxGuests', Math.max(1, +e.target.value))} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Selling Price per Person (R)</label>
                <input type="number" value={draft.pricePerPerson || ''} onChange={e => set('pricePerPerson', +e.target.value || 0)} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Original Price (optional, shows saving)</label>
                <input type="number" value={draft.originalPrice ?? ''} onChange={e => set('originalPrice', e.target.value ? +e.target.value : undefined)} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Tag (optional)</label>
                <input value={draft.tag ?? ''} onChange={e => set('tag', e.target.value)} placeholder="Best Seller / New / Premium" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Status</label>
                <select value={draft.packageStatus} onChange={e => set('packageStatus', e.target.value as PackageStatus)} className={inputCls}>
                  {Object.entries(PACKAGE_STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>Schedule: publish from</label>
                <input type="date" value={draft.publishFrom ?? ''} onChange={e => set('publishFrom', e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Schedule: publish until</label>
                <input type="date" value={draft.publishTo ?? ''} onChange={e => set('publishTo', e.target.value)} className={inputCls} />
              </div>
              <div className="col-span-2">
                <label className={labelCls}>Trip Categories (shown as filter tabs on /packages)</label>
                <div className="flex flex-wrap gap-2">
                  {PACKAGE_CATEGORIES.map(c => {
                    const on = draft.categories.includes(c)
                    return (
                      <button key={c} type="button"
                        onClick={() => set('categories', on ? draft.categories.filter(x => x !== c) : [...draft.categories, c])}
                        className={`font-sans text-xs px-3 py-1.5 border transition-colors ${on ? 'bg-[#C9A96E] border-[#C9A96E] text-[#2d2d2d]' : 'border-gray-200 text-gray-600 hover:border-[#C9A96E]'}`}>
                        {PACKAGE_CATEGORY_LABELS[c]}
                      </button>
                    )
                  })}
                </div>
              </div>
              <div className="col-span-2">
                <label className={labelCls}>Hiking Trails in this Package</label>
                <div className="flex flex-wrap gap-2">
                  {trails.map(t => {
                    const on = draft.trailIds.includes(t.id)
                    return (
                      <button key={t.id} type="button"
                        onClick={() => set('trailIds', on ? draft.trailIds.filter(x => x !== t.id) : [...draft.trailIds, t.id])}
                        className={`font-sans text-xs px-3 py-1.5 border transition-colors ${on ? 'bg-[#2d6a4f] border-[#2d6a4f] text-white' : 'border-gray-200 text-gray-600 hover:border-[#2d6a4f]'}`}>
                        {t.name}
                      </button>
                    )
                  })}
                </div>
              </div>
              <label className="col-span-2 flex items-center gap-2 font-sans text-sm text-gray-600 cursor-pointer">
                <input type="checkbox" checked={draft.featured} onChange={e => set('featured', e.target.checked)} className="accent-[#2d6a4f]" />
                <Star size={13} className="text-[#C9A96E]" /> Feature this package
              </label>
            </div>
          </div>

          <div className="bg-white border border-gray-200 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-display italic text-xl">Components</h2>
                <p className="font-sans text-xs text-gray-400 mt-0.5">Each component keeps its supplier, pricing, margin, commission and rules.</p>
              </div>
              <button
                onClick={() => set('components', [...draft.components, { ...EMPTY_COMPONENT, id: `cmp-${crypto.randomUUID()}` }])}
                className="inline-flex items-center gap-1.5 border border-[#2d6a4f] text-[#2d6a4f] px-3 py-2 font-sans text-xs hover:bg-[#2d6a4f] hover:text-white transition-colors"
              >
                <Plus size={12} /> Add Component
              </button>
            </div>

            {draft.components.length === 0 ? (
              <div className="bg-[#F7F5F2] border border-dashed border-gray-300 py-8 text-center">
                <span className="font-sans text-xs text-gray-400">No components yet — assemble the package from accommodation, activities, trails, experiences, guides, transfers, restaurants, equipment and local experiences.</span>
              </div>
            ) : (
              <div className="space-y-2">
                {draft.components.map((c, i) => (
                  <ComponentEditor
                    key={c.id}
                    component={c}
                    suppliers={suppliers}
                    trails={trails}
                    onChange={next => set('components', draft.components.map((x, j) => (j === i ? next : x)))}
                    onRemove={() => set('components', draft.components.filter((_, j) => j !== i))}
                  />
                ))}
              </div>
            )}

            {draft.components.length > 0 && (
              <div className="flex items-center justify-end gap-6 border-t border-gray-100 pt-4 font-sans text-sm">
                <span className="text-gray-400">Cost: <span className="text-gray-700">R {totals.cost.toLocaleString()}</span></span>
                <span className="text-gray-400">Sell: <span className="text-gray-700">R {totals.sell.toLocaleString()}</span></span>
                <span className="text-gray-400">Margin: <span className={totals.margin >= 0 ? 'text-emerald-600' : 'text-red-500'}>R {totals.margin.toLocaleString()}</span></span>
              </div>
            )}
          </div>

          <div className="bg-white border border-gray-200 p-6">
            <SeoPanel
              seoTitle={draft.seoTitle ?? ''}
              seoDescription={draft.seoDescription ?? ''}
              robotsIndex={draft.robotsIndex}
              previewTitle={draft.title}
              previewSlug={draft.slug}
              urlBase="packages"
              hasImage={!!draft.image}
              contentLength={(draft.description ?? '').length}
              status={draft.packageStatus === 'published' ? 'published' : 'draft'}
              onChangeSeoTitle={v => set('seoTitle', v)}
              onChangeSeoDescription={v => set('seoDescription', v)}
              onChangeRobotsIndex={v => set('robotsIndex', v)}
            />
          </div>

          <div className="flex gap-3">
            <button onClick={save} disabled={saving}
              className="bg-[#2d6a4f] text-white px-6 py-3 font-sans text-sm hover:bg-[#235a3f] transition-colors disabled:opacity-50">
              {saving ? 'Saving…' : editing === 'new' ? 'Create Package' : 'Save Package'}
            </button>
            <button onClick={() => setEditing(null)} className="border border-gray-300 text-gray-600 px-6 py-3 font-sans text-sm hover:border-black transition-colors">Cancel</button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display italic text-3xl text-[#000000] flex items-center gap-3"><Package size={24} className="text-[#C9A96E]" /> Package Builder</h1>
          <p className="font-sans text-sm text-gray-500 mt-1">Administrator-curated multi-supplier packages. Suppliers cannot create marketplace packages.</p>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 font-sans text-xs text-gray-500 cursor-pointer">
            <input type="checkbox" checked={showArchived} onChange={e => setShowArchived(e.target.checked)} className="accent-[#2d6a4f]" />
            Show archived
          </label>
          <button onClick={startNew} className="inline-flex items-center gap-2 bg-[#2d6a4f] text-white px-4 py-2.5 font-sans text-sm hover:bg-[#235a3f] transition-colors">
            <Plus size={14} /> Create Package
          </button>
        </div>
      </div>

      {loading ? (
        <p className="font-sans text-sm text-gray-400 py-12 text-center">Loading packages…</p>
      ) : visible.length === 0 ? (
        <div className="bg-white border border-gray-200 py-20 text-center">
          <Package size={28} className="text-gray-300 mx-auto mb-3" />
          <p className="font-sans text-sm text-gray-400">No packages yet — create the first curated itinerary.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {visible.map(p => {
            const t = packageTotals(p)
            return (
              <div key={p.id} className="bg-white border border-gray-200 p-5">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <h2 className="font-display italic text-xl">{p.title || 'Untitled package'}</h2>
                      <span className={`font-sans text-[10px] tracking-[0.08em] uppercase px-2.5 py-1 ${STATUS_STYLE[p.packageStatus]}`}>
                        {PACKAGE_STATUS_LABELS[p.packageStatus]}
                      </span>
                      {p.featured && <span className="font-sans text-[10px] tracking-[0.08em] uppercase px-2.5 py-1 bg-[#C9A96E] text-white flex items-center gap-1"><Star size={9} /> Featured</span>}
                      {(p.publishFrom || p.publishTo) && (
                        <span className="font-sans text-[10px] text-gray-400 flex items-center gap-1"><CalendarClock size={10} /> {p.publishFrom || '…'} → {p.publishTo || '…'}</span>
                      )}
                    </div>
                    <p className="font-sans text-xs text-gray-400">
                      {p.region || 'No region'} · {p.durationNights} night{p.durationNights !== 1 ? 's' : ''} · <Users size={11} className="inline -mt-0.5" /> max {p.maxGuests} ·{' '}
                      {p.components.length} component{p.components.length !== 1 ? 's' : ''} from {new Set(p.components.map(c => c.supplierName).filter(Boolean)).size} supplier{new Set(p.components.map(c => c.supplierName).filter(Boolean)).size !== 1 ? 's' : ''}
                      {p.trailIds.length > 0 && ` · ${p.trailIds.length} trail${p.trailIds.length !== 1 ? 's' : ''}`}
                    </p>
                    {p.components.length > 0 && (
                      <p className="font-sans text-xs text-gray-500 mt-1.5 truncate">
                        {p.components.map(c => c.title || COMPONENT_TYPE_LABELS[c.type]).join(' · ')}
                      </p>
                    )}
                    {(p.categories ?? []).length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {(p.categories ?? []).map(c => (
                          <span key={c} className="font-sans text-[10px] tracking-[0.06em] uppercase px-2 py-0.5 bg-[#F7F5F2] text-gray-500 border border-gray-200">
                            {PACKAGE_CATEGORY_LABELS[c]}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-display italic text-xl text-[#2d6a4f]">R {p.pricePerPerson.toLocaleString()} <span className="font-sans text-[10px] text-gray-400">pp</span></p>
                    <p className="font-sans text-[10px] text-gray-400">cost R{t.cost.toLocaleString()} · margin <span className={t.margin >= 0 ? 'text-emerald-600' : 'text-red-500'}>R{t.margin.toLocaleString()}</span></p>
                  </div>
                </div>

                <div className="flex items-center gap-2 mt-4 flex-wrap">
                  <ActionBtn onClick={() => startEdit(p)} icon={Pencil} label="Edit" />
                  <ActionBtn onClick={() => duplicate(p)} icon={Copy} label="Duplicate" />
                  {p.packageStatus === 'published' ? (
                    <ActionBtn onClick={() => transition(p, 'ready_for_sale', 'Package hidden from the public site.')} icon={EyeOff} label="Hide" />
                  ) : (
                    <ActionBtn onClick={() => transition(p, 'published', 'Package published.')} icon={Eye} label="Publish" accent />
                  )}
                  <ActionBtn onClick={() => toggleFeature(p)} icon={Star} label={p.featured ? 'Unfeature' : 'Feature'} />
                  {p.packageStatus !== 'archived' ? (
                    <ActionBtn onClick={() => transition(p, 'archived', 'Package archived.')} icon={Archive} label="Archive" />
                  ) : (
                    <>
                      <ActionBtn onClick={() => transition(p, 'draft', 'Package restored to draft.')} icon={Archive} label="Restore" />
                      <ActionBtn onClick={() => remove(p)} icon={Trash2} label="Delete" danger />
                    </>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function ActionBtn({ onClick, icon: Icon, label, accent, danger }: {
  onClick: () => void; icon: React.ElementType; label: string; accent?: boolean; danger?: boolean
}) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 font-sans text-xs px-3 py-2 border transition-colors ${
        danger ? 'border-red-200 text-red-500 hover:bg-red-50'
        : accent ? 'border-[#2d6a4f] bg-[#2d6a4f] text-white hover:bg-[#235a3f]'
        : 'border-gray-200 text-gray-600 hover:border-[#2d6a4f] hover:text-[#2d6a4f]'
      }`}
    >
      <Icon size={12} /> {label}
    </button>
  )
}
