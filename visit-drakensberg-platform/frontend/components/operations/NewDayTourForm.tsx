'use client'

/**
 * Create a Grand Tour day tour from the VD Operations panel, in one form.
 *
 * A day tour is an Activity (lib/activities.ts) owned by its operator — the
 * supplier whose bus and guide run it, who is paid for it and whose bookings
 * it appears in. VD Operations creates it on their behalf: the insert passes
 * RLS through "Managed ops agents write entities" (manage_inventory on that
 * supplier), and the Grand Tour listing passes the guard in
 * 20261008_grand_tour_ops_only.sql for the same reason.
 */

import { useEffect, useState } from 'react'
import { addActivity, ACTIVITY_CATEGORIES, ACTIVITY_INCLUSIONS, type Activity, type ActivityTimeslot } from '@/lib/activities'
import { getRegionNames } from '@/lib/regions'
import { TimeslotEditor } from '@/components/activities/TimeslotEditor'
import { GrandTourEditor, emptyGrandTour, cleanGrandTour } from '@/components/activities/GrandTourEditor'
import type { GrandTourListing } from '@/lib/grand-tour'

export type Operator = { id: string; name: string }

const inp = 'w-full border border-gray-200 bg-white px-3 py-2 font-sans text-sm focus:outline-none focus:border-[#2d6a4f]'
const lbl = 'block font-sans text-[11px] tracking-wider uppercase text-gray-500 mb-1.5'

export default function NewDayTourForm({
  operators, onCreated, onCancel,
}: {
  operators: Operator[]
  onCreated: (a: Activity) => void
  onCancel: () => void
}) {
  const [regions, setRegions] = useState<string[]>([])
  const [operatorId, setOperatorId] = useState(operators.length === 1 ? operators[0].id : '')
  const [name, setName] = useState('')
  const [category, setCategory] = useState<string>('Adventure')
  const [region, setRegion] = useState('')
  const [description, setDescription] = useState('')
  const [durationH, setDurationH] = useState('8')
  const [durationM, setDurationM] = useState('0')
  const [maxGroup, setMaxGroup] = useState('14')
  const [minAge, setMinAge] = useState('0')
  const [price, setPrice] = useState('')
  const [childMaxAge, setChildMaxAge] = useState('')
  const [childPrice, setChildPrice] = useState('')
  const [meetingPoint, setMeetingPoint] = useState('')
  const [photos, setPhotos] = useState('')
  const [included, setIncluded] = useState<string[]>(['Guide', 'Transport to Site'])
  const [whatToWear, setWhatToWear] = useState('')
  const [safetyNotes, setSafetyNotes] = useState('')
  const [timeslots, setTimeslots] = useState<ActivityTimeslot[]>([])
  const [grandTour, setGrandTour] = useState<GrandTourListing>({ ...emptyGrandTour(), enabled: true })
  const [publish, setPublish] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => { getRegionNames().then(setRegions).catch(() => setRegions([])) }, [])

  function toggleIncluded(item: string) {
    setIncluded(list => (list.includes(item) ? list.filter(x => x !== item) : [...list, item]))
  }

  async function submit() {
    const problems = [
      !operatorId && 'choose the operator who runs it',
      !name.trim() && 'give it a name',
      !(Number(price) > 0) && 'set the adult price per seat',
      timeslots.length === 0 && 'add at least one departure time',
      timeslots.some(t => !(t.capacity > 0)) && 'give every departure a seat capacity',
    ].filter(Boolean)
    if (problems.length) { setError(`To save this tour, ${problems.join(', ')}.`); return }

    setSaving(true)
    setError('')
    try {
      const operator = operators.find(o => o.id === operatorId)!
      const created = await addActivity({
        supplierId: operator.id,
        supplierName: operator.name,
        name: name.trim(),
        category,
        region,
        difficulty: 'Easy',
        description: description.trim(),
        durationH: Math.max(0, parseInt(durationH) || 0),
        durationM: Math.max(0, parseInt(durationM) || 0),
        minAge: Math.max(0, parseInt(minAge) || 0),
        maxGroup: Math.max(1, parseInt(maxGroup) || 1),
        meetingPoint: meetingPoint.trim(),
        gpsLat: '',
        gpsLng: '',
        whatToWear: whatToWear.trim(),
        photos: photos.split(/\n+/).map(s => s.trim()).filter(s => /^https:\/\//.test(s)),
        included,
        safetyNotes: safetyNotes.trim(),
        pricePerPerson: Number(price),
        priceGroup: 0,
        ...(childMaxAge ? { childMaxAge: Number(childMaxAge), childPrice: Number(childPrice) || Number(price) } : {}),
        timeslots,
        depositRequired: false,
        depositPercent: '0',
        usesOwnVehicles: true,
        grandTour: cleanGrandTour(grandTour) ?? { ...emptyGrandTour(), enabled: true },
        status: publish ? 'active' : 'draft',
      })
      onCreated(created)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create this tour.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="bg-white border border-gray-200 p-5 sm:p-6 space-y-6">
      <div>
        <h2 className="font-display italic text-2xl">New day tour</h2>
        <p className="font-sans text-sm text-gray-500 mt-1">
          Creates a bookable tour under its operator and puts it on the Grand Tour. Guests book seats per departure.
        </p>
      </div>

      <section className="grid gap-4 sm:grid-cols-2">
        <label className="block sm:col-span-2">
          <span className={lbl}>Operator *</span>
          <select value={operatorId} onChange={e => setOperatorId(e.target.value)} className={inp}>
            <option value="">Who runs this tour?</option>
            {operators.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
          <span className="block font-sans text-[11px] text-gray-400 mt-1">The supplier whose bus and guide run it. Bookings and payouts go to them.</span>
        </label>
        <label className="block sm:col-span-2">
          <span className={lbl}>Tour name *</span>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Sani Pass & Lesotho Day Tour" className={inp} />
        </label>
        <label className="block">
          <span className={lbl}>Category</span>
          <select value={category} onChange={e => setCategory(e.target.value)} className={inp}>
            {ACTIVITY_CATEGORIES.map(c => <option key={c}>{c}</option>)}
          </select>
        </label>
        <label className="block">
          <span className={lbl}>Region it visits</span>
          <select value={region} onChange={e => setRegion(e.target.value)} className={inp}>
            <option value="">Choose a region</option>
            {regions.map(r => <option key={r}>{r}</option>)}
          </select>
        </label>
        <label className="block sm:col-span-2">
          <span className={lbl}>Description</span>
          <textarea value={description} onChange={e => setDescription(e.target.value)} rows={4} className={inp} placeholder="What guests see and do, in a few short paragraphs." />
        </label>
      </section>

      <section className="grid gap-4 grid-cols-2 sm:grid-cols-4">
        <label className="block"><span className={lbl}>Hours</span><input type="number" min={0} value={durationH} onChange={e => setDurationH(e.target.value)} className={inp} /></label>
        <label className="block"><span className={lbl}>Minutes</span><input type="number" min={0} max={59} value={durationM} onChange={e => setDurationM(e.target.value)} className={inp} /></label>
        <label className="block"><span className={lbl}>Max group</span><input type="number" min={1} value={maxGroup} onChange={e => setMaxGroup(e.target.value)} className={inp} /></label>
        <label className="block"><span className={lbl}>Min age</span><input type="number" min={0} value={minAge} onChange={e => setMinAge(e.target.value)} className={inp} /></label>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        <label className="block"><span className={lbl}>Adult price per seat (ZAR) *</span><input type="number" min={0} value={price} onChange={e => setPrice(e.target.value)} className={inp} /></label>
        <label className="block"><span className={lbl}>Child age cutoff</span><input type="number" min={0} value={childMaxAge} onChange={e => setChildMaxAge(e.target.value)} placeholder="Optional, e.g. 12" className={inp} /></label>
        <label className="block"><span className={lbl}>Child price (ZAR)</span><input type="number" min={0} value={childPrice} onChange={e => setChildPrice(e.target.value)} disabled={!childMaxAge} className={`${inp} disabled:opacity-40`} /></label>
      </section>

      <section>
        <p className={lbl}>Departures *</p>
        <p className="font-sans text-[11px] text-gray-400 mb-2">Each time is a bus guests book seats on; capacity is seats per departure.</p>
        <TimeslotEditor timeslots={timeslots} onChange={setTimeslots} />
      </section>

      <section>
        {/* Departures are required above, so the editor's "supplier must add a timeslot" warning does not apply here. */}
        <GrandTourEditor value={grandTour} onChange={setGrandTour} hasTimeslots />
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        <label className="block sm:col-span-2">
          <span className={lbl}>Meeting point (for guests not collected from a hotel)</span>
          <input value={meetingPoint} onChange={e => setMeetingPoint(e.target.value)} className={inp} />
        </label>
        <label className="block sm:col-span-2">
          <span className={lbl}>Photo URLs</span>
          <textarea value={photos} onChange={e => setPhotos(e.target.value)} rows={2} className={inp} placeholder="One https:// link per line. The first is the cover photo." />
        </label>
        <div className="sm:col-span-2">
          <p className={lbl}>Included</p>
          <div className="flex flex-wrap gap-2">
            {ACTIVITY_INCLUSIONS.map(item => (
              <button type="button" key={item} onClick={() => toggleIncluded(item)} aria-pressed={included.includes(item)}
                className={`font-sans text-xs px-3 py-1.5 border ${included.includes(item) ? 'bg-[#2d6a4f] border-[#2d6a4f] text-white' : 'border-gray-200 text-gray-600'}`}>
                {item}
              </button>
            ))}
          </div>
        </div>
        <label className="block"><span className={lbl}>What to bring and wear</span><textarea value={whatToWear} onChange={e => setWhatToWear(e.target.value)} rows={2} className={inp} placeholder="Passport, warm layers, sunscreen" /></label>
        <label className="block"><span className={lbl}>Good to know</span><textarea value={safetyNotes} onChange={e => setSafetyNotes(e.target.value)} rows={2} className={inp} placeholder="Border crossing, altitude, cancellation" /></label>
      </section>

      <label className="flex items-center gap-2 font-sans text-sm text-gray-700">
        <input type="checkbox" checked={publish} onChange={e => setPublish(e.target.checked)} />
        Publish now (otherwise saved as a draft you can preview)
      </label>

      {error && <p className="font-sans text-sm text-red-600" role="alert">{error}</p>}

      <div className="flex gap-3">
        <button onClick={submit} disabled={saving} className="bg-[#2d6a4f] text-white font-sans text-sm px-6 py-2.5 hover:bg-[#235a3f] disabled:opacity-50">
          {saving ? 'Creating…' : 'Create day tour'}
        </button>
        <button onClick={onCancel} className="font-sans text-sm text-gray-500 px-3 py-2.5 hover:text-black">Cancel</button>
      </div>
    </div>
  )
}
