'use client'
import { useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { ChevronRight, ChevronLeft, Plus, Trash2, X } from 'lucide-react'

const PROPERTIES = ['Cathedral Peak Mountain Lodge', 'Berg Valley Guesthouse']
const BED_CONFIGS = ['Single', 'Twin', 'Double', 'Queen', 'King', '2×Queen', '2×King', 'Bunk Beds']
const ROOM_AMENITIES = ['Air Con', 'Heater', 'TV', 'Mini-fridge', 'Safe', 'Balcony', 'Mountain View', 'Private Entrance', 'Wheelchair Accessible']

const STEPS = ['Room Details', 'Pricing & Seasons', 'Photos', 'Review']

type Season = { name: string; from: string; to: string; price: string }

interface RoomData {
  property: string
  name: string
  bedConfig: string
  maxOccupancy: string
  units: string
  sizeSqm: string
  enSuite: boolean
  amenities: string[]
  basePrice: string
  weekendSurcharge: string
  seasons: Season[]
  minNights: string
  cleaningFee: string
  photos: string[]
}

const MOCK: Record<string, RoomData> = {
  '1': {
    property: 'Cathedral Peak Mountain Lodge',
    name: 'Mountain Suite',
    bedConfig: 'King',
    maxOccupancy: '2',
    units: '4',
    sizeSqm: '32',
    enSuite: true,
    amenities: ['Heater', 'TV', 'Mountain View', 'Balcony'],
    basePrice: '2850',
    weekendSurcharge: '15',
    seasons: [
      { name: 'Peak Season', from: '2025-07-01', to: '2025-08-31', price: '3200' },
      { name: 'Festive Season', from: '2025-12-15', to: '2026-01-10', price: '3800' },
    ],
    minNights: '2',
    cleaningFee: '250',
    photos: ['Suite View 1', 'Suite View 2', 'Bathroom'],
  },
  '2': {
    property: 'Cathedral Peak Mountain Lodge',
    name: 'Family Chalet',
    bedConfig: '2×Queen',
    maxOccupancy: '4',
    units: '3',
    sizeSqm: '58',
    enSuite: true,
    amenities: ['Air Con', 'Heater', 'TV', 'Mini-fridge', 'Safe', 'Balcony', 'Mountain View'],
    basePrice: '4200',
    weekendSurcharge: '10',
    seasons: [
      { name: 'Peak Season', from: '2025-07-01', to: '2025-08-31', price: '5100' },
      { name: 'Festive Season', from: '2025-12-15', to: '2026-01-10', price: '5800' },
    ],
    minNights: '2',
    cleaningFee: '400',
    photos: ['Chalet Exterior', 'Living Area', 'Main Bedroom', 'Kids Room'],
  },
  '3': {
    property: 'Cathedral Peak Mountain Lodge',
    name: 'Backpacker Dorm',
    bedConfig: 'Bunk Beds',
    maxOccupancy: '1',
    units: '12',
    sizeSqm: '8',
    enSuite: false,
    amenities: ['Heater'],
    basePrice: '480',
    weekendSurcharge: '0',
    seasons: [
      { name: 'Peak Season', from: '2025-07-01', to: '2025-08-31', price: '550' },
    ],
    minNights: '1',
    cleaningFee: '',
    photos: ['Dorm Room', 'Shared Bathroom'],
  },
  '4': {
    property: 'Berg Valley Guesthouse',
    name: 'Garden Room',
    bedConfig: 'Queen',
    maxOccupancy: '2',
    units: '4',
    sizeSqm: '22',
    enSuite: true,
    amenities: ['Air Con', 'TV'],
    basePrice: '1450',
    weekendSurcharge: '10',
    seasons: [
      { name: 'Peak Season', from: '2025-07-01', to: '2025-08-31', price: '1750' },
      { name: 'Festive Season', from: '2025-12-15', to: '2026-01-10', price: '2100' },
    ],
    minNights: '1',
    cleaningFee: '150',
    photos: ['Garden View', 'Room Interior', 'Bathroom'],
  },
}

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

export default function EditRoomPage() {
  const router = useRouter()
  const params = useParams()
  const id = Array.isArray(params.id) ? params.id[0] : params.id as string

  const defaults = MOCK[id] ?? {
    property: '', name: '', bedConfig: '', maxOccupancy: '', units: '', sizeSqm: '',
    enSuite: false, amenities: [], basePrice: '', weekendSurcharge: '0',
    seasons: [{ name: '', from: '', to: '', price: '' }],
    minNights: '1', cleaningFee: '', photos: [],
  }

  const [step, setStep] = useState(0)
  const [form, setForm] = useState<RoomData>({ ...defaults, seasons: [...defaults.seasons] })

  function setField(key: string, val: unknown) {
    setForm(f => ({ ...f, [key]: val }))
  }

  function toggleAmenity(a: string) {
    setForm(f => ({
      ...f,
      amenities: f.amenities.includes(a) ? f.amenities.filter(x => x !== a) : [...f.amenities, a],
    }))
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

  function removePhoto(i: number) {
    setForm(f => ({ ...f, photos: f.photos.filter((_, idx) => idx !== i) }))
  }

  return (
    <div className="p-8 max-w-2xl">
      <div className="mb-6">
        <button onClick={() => router.back()} className="font-sans text-sm text-black/40 hover:text-black/70 mb-3 flex items-center gap-1">
          <ChevronLeft size={14} /> Rooms
        </button>
        <h1 className="font-display italic text-2xl text-black/90">Edit Room Type</h1>
        {form.name && <p className="font-sans text-sm text-black/50 mt-0.5">{form.name}</p>}
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
              <select value={form.property} onChange={e => setField('property', e.target.value)} className={inp}>
                <option value="">Select property…</option>
                {PROPERTIES.map(p => <option key={p}>{p}</option>)}
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
            <div>
              <p className="font-sans text-sm font-medium text-black/70 mb-3">Room Amenities</p>
              <div className="flex flex-wrap gap-2">
                {ROOM_AMENITIES.map(a => (
                  <button
                    key={a}
                    onClick={() => toggleAmenity(a)}
                    className={`font-sans text-xs px-3 py-1.5 rounded-full border transition-colors ${
                      form.amenities.includes(a) ? 'bg-[#C9A96E] text-white border-[#C9A96E]' : 'border-black/15 text-black/60 hover:border-[#C9A96E]/40'
                    }`}
                  >
                    {a}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        {step === 1 && (
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
                <button
                  onClick={addSeason}
                  className="flex items-center gap-1 font-sans text-xs text-[#C9A96E] hover:text-[#b8965d] border border-[#C9A96E]/30 rounded-lg px-2.5 py-1 hover:border-[#C9A96E]/60 transition-colors"
                >
                  <Plus size={12} /> Add Season
                </button>
              </div>
              <div className="space-y-2">
                {form.seasons.map((s, i) => (
                  <div key={i} className="grid grid-cols-[1fr_1fr_1fr_80px_32px] gap-2 items-start">
                    <input
                      value={s.name}
                      onChange={e => updateSeason(i, 'name', e.target.value)}
                      placeholder="Season name"
                      className={inp}
                    />
                    <input
                      type="date"
                      value={s.from}
                      onChange={e => updateSeason(i, 'from', e.target.value)}
                      className={inp}
                    />
                    <input
                      type="date"
                      value={s.to}
                      onChange={e => updateSeason(i, 'to', e.target.value)}
                      className={inp}
                    />
                    <input
                      type="number"
                      value={s.price}
                      onChange={e => updateSeason(i, 'price', e.target.value)}
                      placeholder="R/night"
                      className={inp}
                    />
                    <button
                      onClick={() => removeSeason(i)}
                      className="h-[34px] flex items-center justify-center text-black/30 hover:text-red-400 transition-colors"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
              {form.seasons.length === 0 && (
                <p className="font-sans text-xs text-black/30 text-center py-4">No seasonal pricing added yet.</p>
              )}
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

        {step === 2 && (
          <div>
            {form.photos.length > 0 && (
              <div className="mb-4">
                <p className="font-sans text-sm font-medium text-black/70 mb-3">Current Photos</p>
                <div className="grid grid-cols-3 gap-3">
                  {form.photos.map((photo, i) => (
                    <div key={i} className="relative aspect-video rounded-lg bg-black/5 border border-black/8 flex items-center justify-center group">
                      <span className="font-sans text-xs text-black/40">{photo}</span>
                      <button
                        onClick={() => removePhoto(i)}
                        className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500"
                      >
                        <X size={10} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className="border-2 border-dashed border-black/10 rounded-lg p-8 text-center">
              <p className="font-sans text-sm text-black/40 mb-1">Drag & drop to add more photos, or click to browse</p>
              <p className="font-sans text-xs text-black/30 mb-3">JPG, PNG, WebP · max 10 MB</p>
              <button className="font-sans text-xs px-3 py-1.5 border border-[#C9A96E]/40 text-[#C9A96E] rounded-lg hover:border-[#C9A96E] hover:bg-[#C9A96E]/5 transition-colors">
                Add More
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-3">
            <p className="font-sans text-sm text-black/60">Review your changes before saving.</p>
            <div className="rounded-lg bg-black/3 p-4 space-y-2">
              {([
                ['Property', form.property],
                ['Room Type', form.name],
                ['Bed Config', form.bedConfig],
                ['Max Occupancy', form.maxOccupancy ? `${form.maxOccupancy} guests` : ''],
                ['Units', form.units],
                ['Room Size', form.sizeSqm ? `${form.sizeSqm} m²` : ''],
                ['En-suite', form.enSuite ? 'Yes' : 'No'],
                ['Base Price', form.basePrice ? `R${form.basePrice}/night` : ''],
                ['Weekend Surcharge', form.weekendSurcharge && form.weekendSurcharge !== '0' ? `${form.weekendSurcharge}%` : 'None'],
                ['Min Nights', form.minNights],
                ['Cleaning Fee', form.cleaningFee ? `R${form.cleaningFee}` : 'None'],
              ] as [string, string][]).map(([k, v]) => v ? (
                <div key={k} className="flex gap-3 font-sans text-sm">
                  <span className="text-black/40 w-36 shrink-0">{k}</span>
                  <span className="text-black/80">{v}</span>
                </div>
              ) : null)}
              {form.amenities.length > 0 && (
                <div className="flex gap-3 font-sans text-sm">
                  <span className="text-black/40 w-36 shrink-0">Amenities</span>
                  <span className="text-black/80">{form.amenities.join(', ')}</span>
                </div>
              )}
              {form.seasons.filter(s => s.name).length > 0 && (
                <div className="flex gap-3 font-sans text-sm">
                  <span className="text-black/40 w-36 shrink-0">Seasonal Pricing</span>
                  <span className="text-black/80">{form.seasons.filter(s => s.name).map(s => `${s.name} (R${s.price})`).join(', ')}</span>
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
            onClick={() => router.push('/supplier/rooms')}
            className="font-sans text-sm px-5 py-2 bg-black text-white rounded-lg hover:bg-black/80 transition-colors"
          >
            Save Changes
          </button>
        )}
      </div>
    </div>
  )
}
