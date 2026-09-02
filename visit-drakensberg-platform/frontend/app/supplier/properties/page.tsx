'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { Building2, Plus, Star, BedDouble, Clock, Zap, Lock } from 'lucide-react'
import { supabase } from '@/lib/auth'
import { effectiveSupplierId } from '@/lib/effective-supplier'
import { getPropertiesBySupplier, updateProperty, type Property } from '@/lib/properties'
import { useManagedSupplier } from '@/lib/managed-supplier-context'

// Whether a property books instantly or takes a confirm-first request is a
// commercial decision, not a supplier preference — see Property.bookingMode
// and lib/stay-requests.ts. So the control below only ever renders for a VD
// Operations employee acting as this supplier (isActingAs), never when the
// supplier themselves is signed into this same page: RLS would technically
// let an owner write their own bookingMode (same "Owners update own
// entities" policy every other property field goes through), but the UI
// never offers them the button, keeping this the deliberate ops/admin call
// the product decision calls for.
const WRITE_PERMISSIONS = ['manage_inventory', 'manage_content']

export default function PropertiesPage() {
  const [properties, setProperties] = useState<Property[]>([])
  const [loading, setLoading] = useState(true)
  const { isActingAs, activeSupplierId, assignedSuppliers } = useManagedSupplier()

  // Mirrors the RLS check on vd_entities' "Managed ops agents update
  // entities" policy exactly, so this button is enabled precisely when the
  // write it triggers will actually succeed.
  const canSetBookingMode = isActingAs && (
    assignedSuppliers.find(s => s.supplier_id === activeSupplierId)
      ?.permissions.some(p => WRITE_PERMISSIONS.includes(p)) ?? false
  )

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { setLoading(false); return }
      getPropertiesBySupplier(effectiveSupplierId(user.id)).then(p => {
        setProperties(p)
        setLoading(false)
      })
    })
  }, [])

  async function toggleBookingMode(p: Property) {
    const next = p.bookingMode === 'request' ? 'instant' : 'request'
    const previous = p.bookingMode
    setProperties(rows => rows.map(r => r.id === p.id ? { ...r, bookingMode: next } : r))
    try {
      await updateProperty(p.id, { bookingMode: next })
      toast.success(next === 'request'
        ? `${p.name} now takes booking requests — guests aren't charged until you confirm.`
        : `${p.name} is back to instant booking.`)
    } catch {
      setProperties(rows => rows.map(r => r.id === p.id ? { ...r, bookingMode: previous } : r))
      toast.error('Could not change the booking mode. Please try again.')
    }
  }

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Building2 size={20} className="text-[#C9A96E]" />
          <h1 className="font-display italic text-2xl text-black/90">Properties</h1>
        </div>
        <Link
          href="/supplier/properties/new"
          className="flex items-center gap-2 bg-[#C9A96E] text-white font-sans text-sm px-4 py-2 rounded-lg hover:bg-[#b8965d] transition-colors"
        >
          <Plus size={15} /> Add Property
        </Link>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-6 h-6 border-2 border-[#C9A96E] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : properties.length === 0 ? (
        <div className="bg-white rounded-xl border border-black/8 p-12 text-center">
          <Building2 size={32} className="text-gray-200 mx-auto mb-3" />
          <p className="font-display italic text-xl text-black/20 mb-2">No properties yet</p>
          <p className="font-sans text-sm text-black/30 mb-5">Add your first property to start managing your accommodation.</p>
          <Link href="/supplier/properties/new" className="inline-flex items-center gap-2 bg-[#C9A96E] text-white font-sans text-sm px-4 py-2 rounded-lg hover:bg-[#b8965d] transition-colors">
            <Plus size={14} /> Add Property
          </Link>
        </div>
      ) : (
        <div className="grid gap-4">
          {properties.map(p => (
            <div key={p.id} className="bg-white rounded-xl border border-black/8 p-5 flex items-center gap-5">
              <div className="w-14 h-14 rounded-lg bg-[#C9A96E]/10 flex items-center justify-center shrink-0">
                <Building2 size={22} className="text-[#C9A96E]" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-sans font-semibold text-black/90 truncate">{p.name}</p>
                <div className="flex items-center gap-4 mt-1">
                  <span className="font-sans text-xs text-black/40">{p.type}</span>
                  {p.starRating && (
                    <span className="font-sans text-xs text-black/40 flex items-center gap-1">
                      <Star size={12} /> {p.starRating} Star
                    </span>
                  )}
                  {p.region && (
                    <span className="font-sans text-xs text-black/40">{p.region}</span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {isActingAs && (
                  canSetBookingMode ? (
                    <button
                      onClick={() => toggleBookingMode(p)}
                      title={p.bookingMode === 'request'
                        ? 'Guests request these dates and you confirm before payment. Click to switch to instant booking.'
                        : 'Books and charges instantly. Click to require your confirmation first.'}
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-sans text-xs transition-colors ${
                        p.bookingMode === 'request'
                          ? 'bg-blue-50 text-blue-700 hover:bg-blue-100'
                          : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                      }`}
                    >
                      {p.bookingMode === 'request' ? <><Clock size={11} /> On request</> : <><Zap size={11} /> Instant</>}
                    </button>
                  ) : (
                    <span
                      title="You don't hold a permission that lets you change this — ask a platform administrator."
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-sans text-xs ${
                        p.bookingMode === 'request' ? 'bg-blue-50 text-blue-700' : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      {p.bookingMode === 'request' ? <Clock size={11} /> : <Zap size={11} />}
                      {p.bookingMode === 'request' ? 'On request' : 'Instant'}
                      <Lock size={9} className="ml-0.5 opacity-60" />
                    </span>
                  )
                )}
                <span className={`font-sans text-xs px-2 py-0.5 rounded-full capitalize ${p.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                  {p.status}
                </span>
                <Link href={`/supplier/properties/${p.id}/edit`} className="font-sans text-xs text-[#C9A96E] hover:underline">Edit</Link>
                <Link href={`/supplier/rooms?property=${p.id}`} className="font-sans text-xs text-black/40 hover:text-black/70 flex items-center gap-1">
                  <BedDouble size={12} /> Rooms
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
