'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import Footer from '@/components/layout/Footer'
import { ArrowLeft, Clock, Users, CheckCircle, Calendar, MapPin } from 'lucide-react'
import UpcomingDepartures from '@/components/tours/UpcomingDepartures'
import { getTourDates } from '@/lib/tour-dates'
import { useBooking } from '@/lib/booking-context'
import { Check, Plus } from 'lucide-react'
import type { Activity } from '@/lib/activities'
import { timeslotsForDate, slotRemaining } from '@/lib/activities'

function mapActivityToView(a: Activity) {
  const durationParts = []
  if (a.durationH) durationParts.push(`${a.durationH}h`)
  if (a.durationM) durationParts.push(`${a.durationM}min`)
  const duration = durationParts.length ? durationParts.join(' ') : 'See details'
  const whatToWear = a.whatToWear
    ? a.whatToWear.split(/[,\n]+/).map((s: string) => s.trim()).filter(Boolean)
    : []
  return {
    title: a.name,
    category: a.category,
    location: a.meetingPoint || '',
    gpsLat: a.gpsLat,
    gpsLng: a.gpsLng,
    duration,
    group_size: a.maxGroup ? `Up to ${a.maxGroup} people` : '',
    price_per_person: a.pricePerPerson || 0,
    // A child rate only applies once the supplier set an age cutoff.
    childPrice: a.childMaxAge ? (a.childPrice || a.pricePerPerson || 0) : undefined,
    childMaxAge: a.childMaxAge || undefined,
    description: a.description,
    includes: Array.isArray(a.included) ? a.included : [],
    what_to_bring: whatToWear,
    // supplierId must travel with the cart item — it's what routes the
    // booking order to this activity's supplier at checkout.
    supplierId: a.supplierId || undefined,
    supplier: { name: a.supplierName || '' },
  }
}

/**
 * Client island rendered inside the server shell (page.tsx), which already
 * resolved `activity` for generateMetadata/JSON-LD and 404s server-side if
 * the id doesn't exist. Everything here — date/group-size selection, the
 * booking-cart toggle — is genuinely interactive and stays client-side; only
 * the entity lookup itself moved server-side. See
 * docs/destination-graph/PHASE_B.md.
 */
export default function ActivityDetail({ activityData, id }: { activityData: Activity; id: string }) {
  const activity = mapActivityToView(activityData)
  const booking = useBooking()
  const hasChildRate = activity.childPrice !== undefined
  const hasTimeslots = !!activityData.timeslots?.length

  const [date, setDate] = useState(booking.checkIn || '')
  const [timeslotId, setTimeslotId] = useState('')
  // Legacy single group-size selector, used only when this activity has no
  // child rate configured.
  const [groupSize, setGroupSize] = useState(booking.guests || 2)
  const [adults, setAdults] = useState(booking.guests || 2)
  const [children, setChildren] = useState(0)

  const dayTimeslots = date ? timeslotsForDate(activityData, date) : []
  // Reset a stale timeslot selection when the date changes or the previously
  // picked slot doesn't run on the newly picked date.
  useEffect(() => {
    if (timeslotId && !dayTimeslots.some(t => t.id === timeslotId)) setTimeslotId('')
  }, [date]) // eslint-disable-line react-hooks/exhaustive-deps

  const finalAdults = hasChildRate ? adults : groupSize
  const finalChildren = hasChildRate ? children : 0
  const guests = finalAdults + finalChildren
  const total = finalAdults * activity.price_per_person + finalChildren * (activity.childPrice ?? activity.price_per_person)
  const selectedSlot = dayTimeslots.find(t => t.id === timeslotId)
  const remaining = selectedSlot ? slotRemaining(activityData, date, selectedSlot.id) : Infinity
  const overCapacity = selectedSlot ? guests > remaining : false

  const addonId = `activity-${id}-${date}${timeslotId ? `-${timeslotId}` : ''}`
  const isAdded = booking.addons.some((a: any) => a.id === addonId)
  const canAdd = !!date && guests > 0 && (!hasTimeslots || !!timeslotId) && !overCapacity

  function toggleAddon() {
    if (isAdded) {
      booking.removeAddon(addonId)
    } else {
      booking.addAddon({
        id: addonId,
        type: 'activity',
        title: activity.title,
        operator: activity.supplier?.name || undefined,
        supplierId: activity.supplierId,
        date: date || undefined,
        price_per_person: guests > 0 ? total / guests : activity.price_per_person,
        guests,
        location: activity.location || undefined,
        lat: activity.gpsLat || undefined,
        lng: activity.gpsLng || undefined,
        ...(hasChildRate ? { adults: finalAdults, children: finalChildren } : {}),
        ...(selectedSlot ? { activityId: id, timeslotId: selectedSlot.id, timeslotTime: selectedSlot.time } : {}),
      })
    }
  }

  return (
    <div className="min-h-screen bg-[#F7F5F2]">

      <section className="bg-[#000000] text-white py-20 px-6 lg:px-12 mt-16">
        <div className="max-w-[1440px] mx-auto">
          <Link href="/activities" className="inline-flex items-center gap-2 text-white/60 hover:text-white text-sm mb-8 transition-colors">
            <ArrowLeft size={16} /> All Activities
          </Link>
          <span className="inline-block font-sans text-[10px] tracking-[0.14em] uppercase bg-[#C9A96E]/20 text-[#C9A96E] px-3 py-1.5 mb-4">{activity.category}</span>
          <h1 className="font-display italic text-5xl lg:text-6xl mb-4">{activity.title}</h1>
          <div className="flex flex-wrap gap-5 font-sans text-sm text-white/60">
            {activity.location && <span className="flex items-center gap-1.5"><MapPin size={14} />{activity.location}</span>}
            {activity.duration && <span className="flex items-center gap-1.5"><Clock size={14} />{activity.duration}</span>}
            {activity.group_size && <span className="flex items-center gap-1.5"><Users size={14} />{activity.group_size}</span>}
          </div>
        </div>
      </section>

      <main className="max-w-[1440px] mx-auto px-6 lg:px-12 py-16">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
          <div className="lg:col-span-2 space-y-12">
            <div>
              <h2 className="font-display italic text-2xl text-[#000000] mb-4">About this Experience</h2>
              <p className="font-sans text-gray-700 leading-relaxed">{activity.description}</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {activity.includes.length > 0 && (
                <div>
                  <h3 className="font-display italic text-xl text-[#000000] mb-4">What's Included</h3>
                  <div className="space-y-2">
                    {activity.includes.map((item: string) => (
                      <div key={item} className="flex items-start gap-2.5">
                        <CheckCircle size={14} className="text-[#2d6a4f] mt-0.5 shrink-0" />
                        <span className="font-sans text-sm text-gray-700">{item}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {activity.what_to_bring.length > 0 && (
                <div>
                  <h3 className="font-display italic text-xl text-[#000000] mb-4">What to Bring</h3>
                  <div className="space-y-2">
                    {activity.what_to_bring.map((item: string) => (
                      <div key={item} className="flex items-start gap-2.5">
                        <span className="text-[#C9A96E] mt-0.5 shrink-0 text-sm">→</span>
                        <span className="font-sans text-sm text-gray-700">{item}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <UpcomingDepartures
              dates={getTourDates(id)}
              context="Scheduled departures, packages and experiences for this activity"
            />

            {activity.supplier.name && (
              <div className="bg-white border border-gray-200 p-6">
                <h3 className="font-display italic text-xl mb-4">About the Provider</h3>
                <div className="flex items-start justify-between">
                  <p className="font-display italic text-2xl">{activity.supplier.name}</p>
                  <button className="border border-[#2d6a4f] text-[#2d6a4f] px-5 py-2.5 font-sans text-sm hover:bg-[#2d6a4f] hover:text-white transition-colors">
                    Contact Supplier
                  </button>
                </div>
              </div>
            )}
          </div>

          <div>
            <div className="bg-white border border-gray-200 p-6 sticky top-24">
              <div className="mb-5">
                <p className="font-sans text-[10px] tracking-[0.12em] uppercase text-gray-400">{hasChildRate ? 'Adult / Child' : 'Per person'}</p>
                <p className="font-display italic text-3xl text-[#2d6a4f]">
                  R {activity.price_per_person.toLocaleString()}
                  {hasChildRate && <span className="text-base text-gray-400"> / R {activity.childPrice!.toLocaleString()} <span className="text-xs">({activity.childMaxAge} & under)</span></span>}
                </p>
              </div>
              <div className="space-y-4 mb-5">
                <div>
                  <label className="block font-sans text-xs uppercase text-gray-400 mb-1.5">Select Date</label>
                  <div className="flex items-center gap-2 border border-gray-300 px-3 py-2.5">
                    <Calendar size={14} className="text-gray-400" />
                    <input type="date" value={date} onChange={e => setDate(e.target.value)} className="flex-1 font-sans text-sm focus:outline-none" />
                  </div>
                </div>

                {hasTimeslots && (
                  <div>
                    <label className="block font-sans text-xs uppercase text-gray-400 mb-1.5">Select Timeslot</label>
                    {!date ? (
                      <p className="font-sans text-xs text-gray-400">Choose a date first.</p>
                    ) : dayTimeslots.length === 0 ? (
                      <p className="font-sans text-xs text-amber-600">No timeslots run on this date — try another day.</p>
                    ) : (
                      <select value={timeslotId} onChange={e => setTimeslotId(e.target.value)} className="w-full border border-gray-300 px-3 py-2.5 font-sans text-sm focus:outline-none">
                        <option value="">Select a time…</option>
                        {dayTimeslots.map(t => {
                          const left = slotRemaining(activityData, date, t.id)
                          return <option key={t.id} value={t.id} disabled={left <= 0}>{t.time}{left <= 0 ? ' — Fully booked' : ` — ${left} seat${left === 1 ? '' : 's'} left`}</option>
                        })}
                      </select>
                    )}
                  </div>
                )}

                {hasChildRate ? (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-sans text-xs uppercase text-gray-400 mb-1.5">Adults</label>
                      <input type="number" min={0} value={adults} onChange={e => setAdults(Math.max(0, parseInt(e.target.value) || 0))} className="w-full border border-gray-300 px-3 py-2.5 font-sans text-sm focus:outline-none" />
                    </div>
                    <div>
                      <label className="block font-sans text-xs uppercase text-gray-400 mb-1.5">Children</label>
                      <input type="number" min={0} value={children} onChange={e => setChildren(Math.max(0, parseInt(e.target.value) || 0))} className="w-full border border-gray-300 px-3 py-2.5 font-sans text-sm focus:outline-none" />
                    </div>
                  </div>
                ) : (
                  <div>
                    <label className="block font-sans text-xs uppercase text-gray-400 mb-1.5">Group Size</label>
                    <select value={groupSize} onChange={e => setGroupSize(parseInt(e.target.value))} className="w-full border border-gray-300 px-3 py-2.5 font-sans text-sm focus:outline-none">
                      {[1,2,3,4,5,6,7,8].map(n => <option key={n} value={n}>{n} person{n !== 1 ? 's' : ''}</option>)}
                    </select>
                  </div>
                )}
              </div>
              <div className="border-t border-gray-100 pt-4 mb-5">
                {hasChildRate ? (
                  <>
                    {finalAdults > 0 && (
                      <div className="flex justify-between font-sans text-sm mb-1">
                        <span className="text-gray-600">R {activity.price_per_person.toLocaleString()} × {finalAdults} adult{finalAdults === 1 ? '' : 's'}</span>
                        <span>R {(activity.price_per_person * finalAdults).toLocaleString()}</span>
                      </div>
                    )}
                    {finalChildren > 0 && (
                      <div className="flex justify-between font-sans text-sm mb-1">
                        <span className="text-gray-600">R {activity.childPrice!.toLocaleString()} × {finalChildren} child{finalChildren === 1 ? '' : 'ren'}</span>
                        <span>R {(activity.childPrice! * finalChildren).toLocaleString()}</span>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="flex justify-between font-sans text-sm mb-1">
                    <span className="text-gray-600">R {activity.price_per_person.toLocaleString()} × {groupSize}</span>
                    <span>R {total.toLocaleString()}</span>
                  </div>
                )}
                <div className="flex justify-between font-sans text-sm font-medium pt-2 border-t border-gray-100 mt-2">
                  <span>Total</span>
                  <span className="text-[#2d6a4f]">R {total.toLocaleString()}</span>
                </div>
              </div>
              {!date && (
                <p className="font-sans text-xs text-amber-600 mb-2">Please select a date to add this activity.</p>
              )}
              {date && hasTimeslots && !timeslotId && dayTimeslots.length > 0 && (
                <p className="font-sans text-xs text-amber-600 mb-2">Please select a timeslot to add this activity.</p>
              )}
              {overCapacity && (
                <p className="font-sans text-xs text-red-500 mb-2">Only {remaining} seat{remaining === 1 ? '' : 's'} left in this timeslot.</p>
              )}
              <button
                onClick={toggleAddon}
                disabled={!canAdd && !isAdded}
                className={`w-full py-3.5 font-sans text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
                  !canAdd && !isAdded
                    ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                    : isAdded
                    ? 'bg-[#2d6a4f] text-white hover:bg-red-600'
                    : 'bg-[#2d6a4f] text-white hover:bg-[#235a3f]'
                }`}
              >
                {isAdded ? <><Check size={14} /> Added to Booking</> : <><Plus size={14} /> Add to Booking</>}
              </button>
              {isAdded && (
                <p className="font-sans text-xs text-center text-[#2d6a4f] mt-2">
                  Saved to your trip — continue exploring
                </p>
              )}
              <p className="font-sans text-xs text-center text-gray-400 mt-2">Free cancellation up to 48 hours before</p>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  )
}
