'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronRight, ChevronLeft, Plus, Trash2 } from 'lucide-react'
import { supabase } from '@/lib/auth'
import { effectiveSupplierId } from '@/lib/effective-supplier'
import { getPropertiesBySupplier, type Property } from '@/lib/properties'
import { addRoom } from '@/lib/rooms'
import { supplierMediaSource } from '@/lib/supplier-media'
import { MediaGalleryPicker } from '@/components/media/MediaPicker'

const BED_CONFIGS = ['Single', 'Twin', 'Double', 'Queen', 'King', '2×Queen', '2×King', 'Bunk Beds']
const ROOM_FEATURES = ['Air Con', 'Heater', 'TV', 'Mini-fridge', 'Safe', 'Balcony', 'Mountain View', 'Private Entrance', 'Wheelchair Accessible', 'Fireplace', 'Kitchenette', 'Bathtub']
const INCLUSIONS_OPTIONS = ['Breakfast', 'Dinner', 'All Meals', 'Towels & Linen', 'Toiletries', 'Wi-Fi', 'Parking', 'Tea & Coffee', 'Welcome Drink', 'Turndown Service']

const STEPS = ['Room Details', 'Features & Inclusions', 'Pricing & Seasons', 'Photos', 'Review']

type Season = { name: string; from: string; to: string; price: string }

const inp = 'w-full font-sans text-sm border border-black/10 rounded-lg px-3 py-2 outline-none focus:border-[#C9A96E]/50 bg-white'

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="font-sans text-sm font-medium text-black/70">
        {label}{required && <span className="text-[#C9A96E] ml-0.5">*</span>}
      </label>
      {children}
    </div>
  )
}

function ChipPicker({ label, options, selected, onChange }: { label: string; options: string[]; selected: string[]; onChange: (v: string[]) => void }) {
  function toggle(a: string) {
    onChange(selected.includes(a) ? selected.filter(x => x !== a) : [...selected, a])
  }
  return (
    <div>
      <p className="font-sans text-sm font-medium text-black/70 mb-3">{label}</p>
      <div className="flex flex-wrap gap-2">
        {options.map(a => (
          <button
            key={a}
            type="button"
            onClick={() => toggle(a)}
            className={`font-sans text-xs px-3 py-1.5 rounded-full border transition-colors ${
              selected.includes(a) ? 'bg-[#C9A96E] text-white border-[#C9A96E]' : 'border-black/15 text-black/60 hover:border-[#C9A96E]/40'
            }`}
          >
            {a}
          </button>
        ))}
      </div>
    </div>
  )
}

function ImageList({ images, onChange }: { images: string[]; onChange: (v: string[]) => void }) {
  return (
    <div className="space-y-2">
      <p className="font-sans text-sm font-medium text-black/70">Photos</p>
      <MediaGalleryPicker value={images} onChange={onChange} source={supplierMediaSource} />
    </div>
  )
}

export default function NewRoomPage() {
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [saving, setSaving] = useState(false)
  const [properties, setProperties] = useState<Property[]>([])

  const [form, setForm] = useState({
    propertyId: '',
    name: '',
    bedConfig: '',
    maxOccupancy: '',
    units: '',
    sizeSqm: '',
    enSuite: false,
    amenities: [] as string[],
    features: [] as string[],
    inclusions: [] as string[],
    images: [] as string[],
    basePrice: '',
    weekendSurcharge: '0',
    seasons: [
      { name: 'Peak Season', from: '2025-07-01', to: '2025-08-31', price: '3200' },
      { name: 'Festive Season', from: '2025-12-15', to: '2026-01-10', price: '3800' },
      { name: '', from: '', to: '', price: '' },
    ] as Season[],
    minNights: '1',
    cleaningFee: '',
  })

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) getPropertiesBySupplier(effectiveSupplierId(user.id)).then(setProperties)
    })
  }, [])

  function setField(key: string, val: unknown) {
    setForm(f => ({ ...f, [key]: val }))
  }

  function updateSeason(i: number, key: keyof Season, val: string) {
    setForm(f => {
      const seasons = [...f.seasons]
      seasons[i] = { ...seasons[i], [key]: val }
      return { ...f, seasons }
    })
  }

  function addSeason() {
    setForm(f => ({ ...f, seasons: [...f.seasons, { name: '', from: '', to: '', price: '' }] }))
  }

  function removeSeason(i: number) {
    setForm(f => ({ ...f, seasons: f.seasons.filter((_, idx) => idx !== i) }))
  }

  async function handleSave() {
    setSaving(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { alert('Not signed in'); return }
      const prop = properties.find(p => p.id === form.propertyId)
      await addRoom({
        propertyId: form.propertyId,
        propertyName: prop?.name ?? '',
        supplierId: user.id,
        name: form.name,
        bedConfig: form.bedConfig,
        maxOccupancy: +form.maxOccupancy || 1,
        units: +form.units || 1,
        sizeSqm: +form.sizeSqm || 0,
        enSuite: form.enSuite,
        amenities: form.amenities,
        features: form.features,
        inclusions: form.inclusions,
        images: form.images,
        basePrice: +form.basePrice || 0,
        weekendSurcharge: +form.weekendSurcharge || 0,
        seasons: form.seasons.filter(s => s.name),
        minNights: +form.minNights || 1,
        cleaningFee: +form.cleaningFee || 0,
        status: 'active',
      })
      router.push('/supplier/rooms')
    } catch (e) {
      console.error('[rooms] save failed:', e)
      alert('Failed to save room type.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="p-8 max-w-2xl">
      <div className="mb-6">
        <button onClick={() => router.back()} className="font-sans text-sm text-black/40 hover:text-black/70 mb-3 flex items-center gap-1">
          <ChevronLeft size={14} /> Rooms
        </button>
        <h1 className="font-display italic text-2xl text-black/90">Add Room Type</h1>
      </div>

      {/* Step indicator */}
      <div className="flex gap-2 mb-8">
        {STEPS.map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <div className={`w-6 h-6 rounded-full flex items-center justify-center font-sans text-xs font-semibold transition-colors ${
              i < step ? 'bg-[#C9A96E] text-white' : i === step ? 'bg-[#C9A96E]/20 text-[#C9A96E] border border-[#C9A96E]' : 'bg-black/5 text-black/30'
            }`}>{i + 1}</div>
            {i < STEPS.length - 1 && <div className={`w-6 h-px ${i < step ? 'bg-[#C9A96E]' : 'bg-black/10'}`} />}
          </div>
        ))}
      </div>
      <p className="font-sans text-xs text-black/40 mb-6 -mt-4">{STEPS[step]}</p>

      <div className="bg-white rounded-xl border border-black/8 p-6 space-y-5">
        {step === 0 && (
          <>
            <Field label="Property" required>
              <select value={form.propertyId} onChange={e => setField('propertyId', e.target.value)} className={inp}>
                <option value="">Select property…</option>
                {properties.length === 0 && <option disabled>No properties yet — add one first</option>}
                {properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </Field>
            <Field label="Room Type Name" required>
              <input value={form.name} onChange={e => setField('name', e.target.value)} placeholder="Mountain Suite" className={inp} />
            </Field>
            <Field label="Bed Configuration" required>
              <select value={form.bedConfig} onChange={e => setField('bedConfig', e.target.value)} className={inp}>
                <option value="">Select configuration…</option>
                {BED_CONFIGS.map(b => <option key={b}>{b}</option>)}
              </select>
            </Field>
            <div className="grid grid-cols-3 gap-4">
              <Field label="Max Occupancy" required>
                <input type="number" min="1" value={form.maxOccupancy} onChange={e => setField('maxOccupancy', e.target.value)} placeholder="2" className={inp} />
              </Field>
              <Field label="Number of Units">
                <input type="number" min="1" value={form.units} onChange={e => setField('units', e.target.value)} placeholder="4" className={inp} />
              </Field>
              <Field label="Room Size (m²)">
                <input type="number" min="1" value={form.sizeSqm} onChange={e => setField('sizeSqm', e.target.value)} placeholder="32" className={inp} />
              </Field>
            </div>
            <div className="flex items-center gap-2.5">
              <input
                type="checkbox"
                id="enSuite"
                checked={form.enSuite}
                onChange={e => setField('enSuite', e.target.checked)}
                className="w-4 h-4 accent-[#C9A96E]"
              />
              <label htmlFor="enSuite" className="font-sans text-sm text-black/70">En-suite bathroom</label>
            </div>
          </>
        )}

        {step === 1 && (
          <>
            <ChipPicker label="Room Features (in-room amenities)" options={ROOM_FEATURES} selected={form.features} onChange={v => setField('features', v)} />
            <ChipPicker label="What's Included" options={INCLUSIONS_OPTIONS} selected={form.inclusions} onChange={v => setField('inclusions', v)} />
          </>
        )}

        {step === 2 && (
          <>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Base Price per Night (ZAR)" required>
                <input type="number" min="0" value={form.basePrice} onChange={e => setField('basePrice', e.target.value)} placeholder="2500" className={inp} />
              </Field>
              <Field label="Weekend Surcharge (%)">
                <input type="number" min="0" max="100" value={form.weekendSurcharge} onChange={e => setField('weekendSurcharge', e.target.value)} placeholder="0" className={inp} />
              </Field>
            </div>

            <div>
              <div className="flex items-center justify-between mb-3">
                <p className="font-sans text-sm font-medium text-black/70">Seasonal Pricing</p>
                <button type="button" onClick={addSeason} className="flex items-center gap-1 font-sans text-xs text-[#C9A96E] border border-[#C9A96E]/30 rounded-lg px-2.5 py-1 hover:border-[#C9A96E]/60">
                  <Plus size={12} /> Add Season
                </button>
              </div>
              <div className="space-y-2">
                {form.seasons.map((s, i) => (
                  <div key={i} className="grid grid-cols-[1fr_1fr_1fr_80px_32px] gap-2 items-start">
                    <input value={s.name} onChange={e => updateSeason(i, 'name', e.target.value)} placeholder="Season name" className={inp} />
                    <input type="date" value={s.from} onChange={e => updateSeason(i, 'from', e.target.value)} className={inp} />
                    <input type="date" value={s.to} onChange={e => updateSeason(i, 'to', e.target.value)} className={inp} />
                    <input type="number" value={s.price} onChange={e => updateSeason(i, 'price', e.target.value)} placeholder="R/night" className={inp} />
                    <button type="button" onClick={() => removeSeason(i)} className="h-[34px] flex items-center justify-center text-black/30 hover:text-red-400">
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Field label="Minimum Nights Stay">
                <input type="number" min="1" value={form.minNights} onChange={e => setField('minNights', e.target.value)} className={inp} />
              </Field>
              <Field label="Cleaning Fee (ZAR, optional)">
                <input type="number" min="0" value={form.cleaningFee} onChange={e => setField('cleaningFee', e.target.value)} placeholder="0" className={inp} />
              </Field>
            </div>
          </>
        )}

        {step === 3 && (
          <ImageList images={form.images} onChange={v => setField('images', v)} />
        )}

        {step === 4 && (
          <div className="space-y-3">
            <p className="font-sans text-sm text-black/60">Review your room type details before adding.</p>
            <div className="rounded-lg bg-black/3 p-4 space-y-2">
              {([
                ['Property', properties.find(p => p.id === form.propertyId)?.name ?? ''],
                ['Room Type', form.name],
                ['Bed Config', form.bedConfig],
                ['Max Occupancy', form.maxOccupancy ? `${form.maxOccupancy} guests` : ''],
                ['Units', form.units],
                ['Room Size', form.sizeSqm ? `${form.sizeSqm} m²` : ''],
                ['En-suite', form.enSuite ? 'Yes' : 'No'],
                ['Base Price', form.basePrice ? `R${form.basePrice}/night` : ''],
                ['Min Nights', form.minNights],
                ['Cleaning Fee', form.cleaningFee ? `R${form.cleaningFee}` : 'None'],
              ] as [string, string][]).map(([k, v]) => v ? (
                <div key={k} className="flex gap-3 font-sans text-sm">
                  <span className="text-black/40 w-36 shrink-0">{k}</span>
                  <span className="text-black/80">{v}</span>
                </div>
              ) : null)}
              {form.features.length > 0 && (
                <div className="flex gap-3 font-sans text-sm">
                  <span className="text-black/40 w-36 shrink-0">Features</span>
                  <span className="text-black/80">{form.features.join(', ')}</span>
                </div>
              )}
              {form.inclusions.length > 0 && (
                <div className="flex gap-3 font-sans text-sm">
                  <span className="text-black/40 w-36 shrink-0">Inclusions</span>
                  <span className="text-black/80">{form.inclusions.join(', ')}</span>
                </div>
              )}
              {form.images.length > 0 && (
                <div className="flex gap-3 font-sans text-sm">
                  <span className="text-black/40 w-36 shrink-0">Images</span>
                  <span className="text-black/80">{form.images.length} photo{form.images.length !== 1 ? 's' : ''}</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="flex justify-between mt-6">
        <button
          onClick={() => setStep(s => s - 1)}
          disabled={step === 0}
          className="font-sans text-sm px-4 py-2 border border-black/15 rounded-lg text-black/60 hover:border-black/30 disabled:opacity-30 disabled:cursor-not-allowed"
        >
          Back
        </button>
        {step < STEPS.length - 1 ? (
          <button
            onClick={() => setStep(s => s + 1)}
            className="flex items-center gap-2 font-sans text-sm px-5 py-2 bg-[#C9A96E] text-white rounded-lg hover:bg-[#b8965d] transition-colors"
          >
            Next <ChevronRight size={14} />
          </button>
        ) : (
          <button
            onClick={handleSave}
            disabled={saving || !form.name || !form.propertyId}
            className="font-sans text-sm px-5 py-2 bg-black text-white rounded-lg hover:bg-black/80 transition-colors disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Add Room Type'}
          </button>
        )}
      </div>
    </div>
  )
}
