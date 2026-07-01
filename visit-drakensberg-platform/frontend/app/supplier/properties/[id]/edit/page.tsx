'use client'
import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ChevronRight, ChevronLeft } from 'lucide-react'
import { getPropertyById, updateProperty, PROPERTY_REGIONS } from '@/lib/properties'
import { getRegionNames } from '@/lib/regions'
import { GoogleAddressField } from '@/components/maps/GoogleAddressField'

const PROPERTY_TYPES = ['Lodge', 'Guesthouse', 'Hotel', 'Self-catering Cottage', 'Campsite', 'Backpackers', 'Boutique Hotel']
const AMENITIES = ['Swimming Pool', 'Braai Facilities', 'Wi-Fi', 'Restaurant', 'Bar', 'Spa', 'Gym', 'Laundry', 'Pet-Friendly', 'Wheelchair Access', 'Airport Transfers', 'Hiking Trails Access']
const STEPS = ['Property Details', 'Location & Access', 'Amenities & Policies', 'Photos', 'Review & Submit']

export default function EditPropertyPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [saving, setSaving] = useState(false)
  const [regions, setRegions] = useState<string[]>(PROPERTY_REGIONS)
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState({
    name: '', type: '', description: '', starRating: '',
    region: '', address: '', gpsLat: '', gpsLng: '', accessNotes: '',
    amenities: [] as string[], checkIn: '14:00', checkOut: '10:00', petPolicy: '', cancellationPolicy: '48',
    photos: [] as string[],
    status: 'active' as 'active' | 'draft',
  })

  useEffect(() => {
    getPropertyById(id).then(p => {
      if (p) {
        setForm({
          name: p.name,
          type: p.type,
          description: p.description,
          starRating: p.starRating,
          region: p.region,
          address: p.address,
          gpsLat: p.gpsLat,
          gpsLng: p.gpsLng,
          accessNotes: p.accessNotes,
          amenities: p.amenities,
          checkIn: p.checkIn,
          checkOut: p.checkOut,
          petPolicy: p.petPolicy,
          cancellationPolicy: p.cancellationPolicy,
          photos: p.photos,
          status: p.status,
        })
      }
      setLoading(false)
    })
  }, [id])

  useEffect(() => {
    getRegionNames().then(setRegions)
  }, [])

  function setField(key: string, val: unknown) {
    setForm(f => ({ ...f, [key]: val }))
  }

  function toggleAmenity(a: string) {
    setForm(f => ({
      ...f,
      amenities: f.amenities.includes(a) ? f.amenities.filter(x => x !== a) : [...f.amenities, a],
    }))
  }

  async function handleSubmit() {
    setSaving(true)
    try {
      await updateProperty(id, {
        name: form.name,
        type: form.type,
        starRating: form.starRating,
        description: form.description,
        region: form.region,
        address: form.address,
        gpsLat: form.gpsLat,
        gpsLng: form.gpsLng,
        accessNotes: form.accessNotes,
        amenities: form.amenities,
        checkIn: form.checkIn,
        checkOut: form.checkOut,
        petPolicy: form.petPolicy,
        cancellationPolicy: form.cancellationPolicy,
        photos: form.photos,
        status: form.status,
      })
      router.push('/supplier/properties')
    } catch (e) {
      console.error('[properties] update failed:', e)
      alert('Failed to save changes.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-[#C9A96E] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="p-8 max-w-2xl">
      <div className="mb-6">
        <button onClick={() => router.back()} className="font-sans text-sm text-black/40 hover:text-black/70 mb-3 flex items-center gap-1">
          <ChevronLeft size={14} /> Properties
        </button>
        <h1 className="font-display italic text-2xl text-black/90">Edit Property</h1>
      </div>

      <div className="flex gap-2 mb-8">
        {STEPS.map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <div className={`w-6 h-6 rounded-full flex items-center justify-center font-sans text-xs font-semibold transition-colors ${i < step ? 'bg-[#C9A96E] text-white' : i === step ? 'bg-[#C9A96E]/20 text-[#C9A96E] border border-[#C9A96E]' : 'bg-black/5 text-black/30'}`}>{i + 1}</div>
            {i < STEPS.length - 1 && <div className={`w-6 h-px ${i < step ? 'bg-[#C9A96E]' : 'bg-black/10'}`} />}
          </div>
        ))}
      </div>
      <p className="font-sans text-xs text-black/40 mb-6 -mt-4">{STEPS[step]}</p>

      <div className="bg-white rounded-xl border border-black/8 p-6 space-y-5">
        {step === 0 && (
          <>
            <Field label="Property Name" required>
              <input value={form.name} onChange={e => setField('name', e.target.value)} placeholder="Cathedral Peak Mountain Lodge" className={input} />
            </Field>
            <Field label="Property Type" required>
              <select value={form.type} onChange={e => setField('type', e.target.value)} className={input}>
                <option value="">Select type…</option>
                {PROPERTY_TYPES.map(t => <option key={t}>{t}</option>)}
              </select>
            </Field>
            <Field label="Star Rating">
              <select value={form.starRating} onChange={e => setField('starRating', e.target.value)} className={input}>
                <option value="">Unrated</option>
                {[1,2,3,4,5].map(n => <option key={n} value={n}>{n} Star</option>)}
              </select>
            </Field>
            <Field label="Description" required>
              <textarea value={form.description} onChange={e => setField('description', e.target.value)} rows={4} placeholder="Describe the property, setting, and what makes it special…" className={`${input} resize-none`} />
            </Field>
            <Field label="Status">
              <select value={form.status} onChange={e => setField('status', e.target.value as 'active' | 'draft')} className={input}>
                <option value="active">Active</option>
                <option value="draft">Draft</option>
              </select>
            </Field>
          </>
        )}

        {step === 1 && (
          <>
            <Field label="Region" required>
              <select value={form.region} onChange={e => setField('region', e.target.value)} className={input}>
                <option value="">Select region…</option>
                {regions.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </Field>
            <GoogleAddressField
              label="Street Address"
              value={form.address}
              lat={form.gpsLat}
              lng={form.gpsLng}
              placeholder="Start typing the property address"
              inputClassName={input}
              labelClassName="font-sans text-sm font-medium text-black/70"
              onChange={({ address, lat, lng }) => {
                setField('address', address)
                if (lat) setField('gpsLat', lat)
                if (lng) setField('gpsLng', lng)
              }}
            />
            <div className="grid grid-cols-2 gap-4">
              <Field label="GPS Latitude">
                <input value={form.gpsLat} onChange={e => setField('gpsLat', e.target.value)} placeholder="-29.123456" className={input} />
              </Field>
              <Field label="GPS Longitude">
                <input value={form.gpsLng} onChange={e => setField('gpsLng', e.target.value)} placeholder="29.123456" className={input} />
              </Field>
            </div>
            <Field label="Access Notes">
              <textarea value={form.accessNotes} onChange={e => setField('accessNotes', e.target.value)} rows={3} placeholder="4×4 recommended in wet season, last 8 km gravel road…" className={`${input} resize-none`} />
            </Field>
          </>
        )}

        {step === 2 && (
          <>
            <div>
              <p className="font-sans text-sm font-medium text-black/70 mb-3">Amenities</p>
              <div className="flex flex-wrap gap-2">
                {AMENITIES.map(a => (
                  <button key={a} onClick={() => toggleAmenity(a)} className={`font-sans text-xs px-3 py-1.5 rounded-full border transition-colors ${form.amenities.includes(a) ? 'bg-[#C9A96E] text-white border-[#C9A96E]' : 'border-black/15 text-black/60 hover:border-[#C9A96E]/40'}`}>{a}</button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Check-in Time">
                <input type="time" value={form.checkIn} onChange={e => setField('checkIn', e.target.value)} className={input} />
              </Field>
              <Field label="Check-out Time">
                <input type="time" value={form.checkOut} onChange={e => setField('checkOut', e.target.value)} className={input} />
              </Field>
            </div>
            <Field label="Cancellation Policy (hours notice)">
              <select value={form.cancellationPolicy} onChange={e => setField('cancellationPolicy', e.target.value)} className={input}>
                <option value="24">24 hours</option>
                <option value="48">48 hours</option>
                <option value="72">72 hours</option>
                <option value="168">7 days</option>
              </select>
            </Field>
            <Field label="Pet Policy">
              <input value={form.petPolicy} onChange={e => setField('petPolicy', e.target.value)} placeholder="Pets allowed on request, R150/night surcharge…" className={input} />
            </Field>
          </>
        )}

        {step === 3 && (
          <div>
            <p className="font-sans text-sm font-medium text-black/70 mb-3">Photo URLs</p>
            <div className="space-y-2">
              {[...form.photos, ''].map((url, i) => (
                <input
                  key={i}
                  value={url}
                  onChange={e => {
                    const updated = [...form.photos]
                    if (i === form.photos.length) {
                      if (e.target.value) updated.push(e.target.value)
                    } else {
                      updated[i] = e.target.value
                      if (!e.target.value) updated.splice(i, 1)
                    }
                    setField('photos', updated)
                  }}
                  placeholder={i === form.photos.length ? 'Add photo URL…' : `Photo ${i + 1}`}
                  className={input}
                />
              ))}
            </div>
            {form.photos.length > 0 && (
              <div className="grid grid-cols-3 gap-2 mt-4">
                {form.photos.filter(Boolean).map((url, i) => (
                  <img key={i} src={url} alt="" className="aspect-video object-cover rounded border border-black/10" onError={e => (e.currentTarget.style.display = 'none')} />
                ))}
              </div>
            )}
          </div>
        )}

        {step === 4 && (
          <div className="space-y-3">
            <p className="font-sans text-sm text-black/60">Review your property details before saving.</p>
            <div className="rounded-lg bg-black/3 p-4 space-y-2">
              {[['Name', form.name], ['Type', form.type], ['Star Rating', form.starRating || 'Unrated'], ['Region', form.region], ['Address', form.address], ['Check-in', form.checkIn], ['Check-out', form.checkOut], ['Status', form.status]].map(([k, v]) => v ? (
                <div key={k} className="flex gap-3 font-sans text-sm">
                  <span className="text-black/40 w-32 shrink-0">{k}</span>
                  <span className="text-black/80 capitalize">{v}</span>
                </div>
              ) : null)}
              {form.amenities.length > 0 && (
                <div className="flex gap-3 font-sans text-sm">
                  <span className="text-black/40 w-32 shrink-0">Amenities</span>
                  <span className="text-black/80">{form.amenities.join(', ')}</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="flex justify-between mt-6">
        <button onClick={() => setStep(s => s - 1)} disabled={step === 0} className="font-sans text-sm px-4 py-2 border border-black/15 rounded-lg text-black/60 hover:border-black/30 disabled:opacity-30 disabled:cursor-not-allowed">Back</button>
        {step < STEPS.length - 1 ? (
          <button onClick={() => setStep(s => s + 1)} disabled={step === 0 && (!form.name || !form.type)} className="flex items-center gap-2 font-sans text-sm px-5 py-2 bg-[#C9A96E] text-white rounded-lg hover:bg-[#b8965d] transition-colors disabled:opacity-40">
            Next <ChevronRight size={14} />
          </button>
        ) : (
          <button onClick={handleSubmit} disabled={saving || !form.name || !form.type} className="font-sans text-sm px-5 py-2 bg-black text-white rounded-lg hover:bg-black/80 transition-colors disabled:opacity-50">
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        )}
      </div>
    </div>
  )
}

const input = 'w-full font-sans text-sm border border-black/10 rounded-lg px-3 py-2 outline-none focus:border-[#C9A96E]/50 bg-white'

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="font-sans text-sm font-medium text-black/70">{label}{required && <span className="text-[#C9A96E] ml-0.5">*</span>}</label>
      {children}
    </div>
  )
}
