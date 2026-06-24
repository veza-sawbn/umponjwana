'use client'
import { useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { ChevronRight, ChevronLeft } from 'lucide-react'

const PROPERTY_TYPES = ['Lodge', 'Guesthouse', 'Hotel', 'Self-catering Cottage', 'Campsite', 'Backpackers', 'Boutique Hotel']
const AMENITIES = ['Swimming Pool', 'Braai Facilities', 'Wi-Fi', 'Restaurant', 'Bar', 'Spa', 'Gym', 'Laundry', 'Pet-Friendly', 'Wheelchair Access', 'Airport Transfers', 'Hiking Trails Access']

const STEPS = ['Property Details', 'Location & Access', 'Amenities & Policies', 'Photos', 'Review & Submit']

const MOCK: Record<string, {
  name: string; type: string; description: string; starRating: string;
  address: string; gpsLat: string; gpsLng: string; nearestTown: string; accessNotes: string;
  amenities: string[]; checkIn: string; checkOut: string; petPolicy: string; cancellationPolicy: string;
}> = {
  '1': {
    name: 'Cathedral Peak Mountain Lodge',
    type: 'Lodge',
    description: 'A premier mountain lodge nestled beneath Cathedral Peak, offering breathtaking views of the Drakensberg amphitheatre. The perfect base for hiking, birding, and star-gazing.',
    starRating: '4',
    address: 'Cathedral Peak Road, Winterton, KwaZulu-Natal',
    gpsLat: '-28.987210',
    gpsLng: '29.209840',
    nearestTown: 'Winterton',
    accessNotes: '4×4 recommended in wet season. Last 14 km is gravel road. Clearly signposted from the R600.',
    amenities: ['Swimming Pool', 'Braai Facilities', 'Wi-Fi', 'Restaurant', 'Bar', 'Hiking Trails Access'],
    checkIn: '14:00',
    checkOut: '10:00',
    petPolicy: 'No pets allowed.',
    cancellationPolicy: '48',
  },
  '2': {
    name: 'Berg Valley Guesthouse',
    type: 'Guesthouse',
    description: 'A charming family-run guesthouse in the heart of the Drakensberg foothills. Ideal for couples and families seeking a tranquil retreat with spectacular mountain scenery.',
    starRating: '3',
    address: '12 Valley Road, Bergville, KwaZulu-Natal',
    gpsLat: '-28.730450',
    gpsLng: '29.364120',
    nearestTown: 'Bergville',
    accessNotes: 'Fully tarred road access. Turn left at the Bergville Shell garage and follow signs for 3 km.',
    amenities: ['Braai Facilities', 'Wi-Fi', 'Laundry', 'Pet-Friendly'],
    checkIn: '13:00',
    checkOut: '11:00',
    petPolicy: 'Small dogs welcome. Please inform us in advance. R100/night surcharge.',
    cancellationPolicy: '24',
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

export default function EditPropertyPage() {
  const router = useRouter()
  const params = useParams()
  const id = Array.isArray(params.id) ? params.id[0] : params.id as string

  const defaults = MOCK[id] ?? {
    name: '', type: '', description: '', starRating: '',
    address: '', gpsLat: '', gpsLng: '', nearestTown: '', accessNotes: '',
    amenities: [], checkIn: '14:00', checkOut: '10:00', petPolicy: '', cancellationPolicy: '48',
  }

  const [step, setStep] = useState(0)
  const [form, setForm] = useState({ ...defaults })

  function setField(key: string, val: unknown) {
    setForm(f => ({ ...f, [key]: val }))
  }

  function toggleAmenity(a: string) {
    setForm(f => ({
      ...f,
      amenities: f.amenities.includes(a) ? f.amenities.filter(x => x !== a) : [...f.amenities, a],
    }))
  }

  return (
    <div className="p-8 max-w-2xl">
      <div className="mb-6">
        <button onClick={() => router.back()} className="font-sans text-sm text-black/40 hover:text-black/70 mb-3 flex items-center gap-1">
          <ChevronLeft size={14} /> Properties
        </button>
        <h1 className="font-display italic text-2xl text-black/90">Edit Property</h1>
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
            <Field label="Property Name" required>
              <input value={form.name} onChange={e => setField('name', e.target.value)} placeholder="Cathedral Peak Mountain Lodge" className={inp} />
            </Field>
            <Field label="Property Type" required>
              <select value={form.type} onChange={e => setField('type', e.target.value)} className={inp}>
                <option value="">Select type…</option>
                {PROPERTY_TYPES.map(t => <option key={t}>{t}</option>)}
              </select>
            </Field>
            <Field label="Star Rating">
              <select value={form.starRating} onChange={e => setField('starRating', e.target.value)} className={inp}>
                <option value="">Unrated</option>
                {[1,2,3,4,5].map(n => <option key={n} value={n}>{n} Star</option>)}
              </select>
            </Field>
            <Field label="Description" required>
              <textarea value={form.description} onChange={e => setField('description', e.target.value)} rows={4} placeholder="Describe the property, setting, and what makes it special…" className={`${inp} resize-none`} />
            </Field>
          </>
        )}

        {step === 1 && (
          <>
            <Field label="Street Address" required>
              <input value={form.address} onChange={e => setField('address', e.target.value)} className={inp} />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="GPS Latitude">
                <input value={form.gpsLat} onChange={e => setField('gpsLat', e.target.value)} placeholder="-29.123456" className={inp} />
              </Field>
              <Field label="GPS Longitude">
                <input value={form.gpsLng} onChange={e => setField('gpsLng', e.target.value)} placeholder="29.123456" className={inp} />
              </Field>
            </div>
            <Field label="Nearest Town / Village">
              <input value={form.nearestTown} onChange={e => setField('nearestTown', e.target.value)} className={inp} />
            </Field>
            <Field label="Access Notes">
              <textarea value={form.accessNotes} onChange={e => setField('accessNotes', e.target.value)} rows={3} placeholder="4×4 recommended in wet season, last 8 km gravel road…" className={`${inp} resize-none`} />
            </Field>
          </>
        )}

        {step === 2 && (
          <>
            <div>
              <p className="font-sans text-sm font-medium text-black/70 mb-3">Amenities</p>
              <div className="flex flex-wrap gap-2">
                {AMENITIES.map(a => (
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
            <div className="grid grid-cols-2 gap-4">
              <Field label="Check-in Time">
                <input type="time" value={form.checkIn} onChange={e => setField('checkIn', e.target.value)} className={inp} />
              </Field>
              <Field label="Check-out Time">
                <input type="time" value={form.checkOut} onChange={e => setField('checkOut', e.target.value)} className={inp} />
              </Field>
            </div>
            <Field label="Cancellation Policy (hours notice)">
              <select value={form.cancellationPolicy} onChange={e => setField('cancellationPolicy', e.target.value)} className={inp}>
                <option value="24">24 hours</option>
                <option value="48">48 hours</option>
                <option value="72">72 hours</option>
                <option value="168">7 days</option>
              </select>
            </Field>
            <Field label="Pet Policy">
              <input value={form.petPolicy} onChange={e => setField('petPolicy', e.target.value)} placeholder="Pets allowed on request, R150/night surcharge…" className={inp} />
            </Field>
          </>
        )}

        {step === 3 && (
          <div>
            <div className="border-2 border-dashed border-black/10 rounded-lg p-10 text-center mb-4">
              <p className="font-sans text-sm text-black/40 mb-1">Drag & drop photos here, or click to browse</p>
              <p className="font-sans text-xs text-black/30">JPG, PNG, WebP · max 10 MB</p>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {[1, 2, 3].map(n => (
                <div key={n} className="aspect-video rounded-lg bg-black/5 border border-black/8 flex items-center justify-center">
                  <span className="font-sans text-xs text-black/25">Photo {n}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-3">
            <p className="font-sans text-sm text-black/60">Review your changes before saving.</p>
            <div className="rounded-lg bg-black/3 p-4 space-y-2">
              {([['Name', form.name], ['Type', form.type], ['Star Rating', form.starRating || 'Unrated'], ['Address', form.address], ['Nearest Town', form.nearestTown], ['Check-in', form.checkIn], ['Check-out', form.checkOut], ['Pet Policy', form.petPolicy]] as [string, string][]).map(([k, v]) => v ? (
                <div key={k} className="flex gap-3 font-sans text-sm">
                  <span className="text-black/40 w-32 shrink-0">{k}</span>
                  <span className="text-black/80">{v}</span>
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
            onClick={() => router.push('/supplier/properties')}
            className="font-sans text-sm px-5 py-2 bg-black text-white rounded-lg hover:bg-black/80 transition-colors"
          >
            Save Changes
          </button>
        )}
      </div>
    </div>
  )
}
