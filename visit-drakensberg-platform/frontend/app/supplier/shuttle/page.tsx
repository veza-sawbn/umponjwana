'use client'

import { useState } from 'react'
import Link from 'next/link'
import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import { ArrowLeft, Plus, Trash2, Truck, CheckCircle, Clock, AlertCircle, Upload, Calendar, MapPin, User } from 'lucide-react'

interface Vehicle {
  id: string
  make: string
  model: string
  year: number
  registration: string
  capacity: number
  dot_permit_number: string
  pli_policy_number: string
  tourism_permit_number: string
  driver_name: string
  driver_pdp_number: string
  is_verified: boolean
  is_active: boolean
}

interface ShuttleBooking {
  id: string
  guest_name: string
  from: string
  to: string
  date: string
  pickup_time: string
  passengers: number
  vehicle_id: string
  status: 'confirmed' | 'pending' | 'completed'
}

const INIT_VEHICLES: Vehicle[] = [
  {
    id: '1',
    make: 'Toyota',
    model: 'Quantum',
    year: 2022,
    registration: 'KZN 123 GP',
    capacity: 14,
    dot_permit_number: 'DOT-KZN-00421',
    pli_policy_number: 'PLI-2024-88712',
    tourism_permit_number: 'TBCSA-T-0091',
    driver_name: 'Siphamandla Khumalo',
    driver_pdp_number: 'PDP-2024-KZN-5521',
    is_verified: true,
    is_active: true,
  },
]

const INIT_BOOKINGS: ShuttleBooking[] = [
  { id: 'b1', guest_name: 'Sarah Thompson', from: 'King Shaka Airport', to: 'Cathedral Peak Hotel', date: '2026-07-18', pickup_time: '10:30', passengers: 3, vehicle_id: '1', status: 'confirmed' },
  { id: 'b2', guest_name: 'Mark & Lisa Dube', from: 'Pietermaritzburg', to: 'Drakensberg Sun Resort', date: '2026-07-20', pickup_time: '14:00', passengers: 2, vehicle_id: '1', status: 'confirmed' },
  { id: 'b3', guest_name: 'Johan van der Berg', from: 'Drakensberg Sun Resort', to: 'King Shaka Airport', date: '2026-07-15', pickup_time: '06:00', passengers: 4, vehicle_id: '1', status: 'completed' },
]

const statusConfig = {
  confirmed: { label: 'Confirmed', color: 'bg-[#2d6a4f]/10 text-[#2d6a4f]' },
  pending: { label: 'Pending', color: 'bg-[#C9A96E]/10 text-[#9a7840]' },
  completed: { label: 'Completed', color: 'bg-gray-100 text-gray-500' },
}

export default function ShuttlePage() {
  const [vehicles, setVehicles] = useState<Vehicle[]>(INIT_VEHICLES)
  const [bookings] = useState<ShuttleBooking[]>(INIT_BOOKINGS)
  const [showForm, setShowForm] = useState(false)
  const [activeTab, setActiveTab] = useState<'fleet' | 'bookings' | 'schedule'>('fleet')
  const [form, setForm] = useState({
    make: '', model: '', year: '', registration: '', capacity: '',
    dot_permit_number: '', pli_policy_number: '', tourism_permit_number: '',
    driver_name: '', driver_pdp_number: '',
  })

  function handleRegister() {
    if (!form.make || !form.model || !form.registration) return
    const v: Vehicle = {
      id: Date.now().toString(),
      make: form.make,
      model: form.model,
      year: parseInt(form.year) || new Date().getFullYear(),
      registration: form.registration,
      capacity: parseInt(form.capacity) || 0,
      dot_permit_number: form.dot_permit_number,
      pli_policy_number: form.pli_policy_number,
      tourism_permit_number: form.tourism_permit_number,
      driver_name: form.driver_name,
      driver_pdp_number: form.driver_pdp_number,
      is_verified: false,
      is_active: true,
    }
    setVehicles(prev => [...prev, v])
    setForm({ make: '', model: '', year: '', registration: '', capacity: '', dot_permit_number: '', pli_policy_number: '', tourism_permit_number: '', driver_name: '', driver_pdp_number: '' })
    setShowForm(false)
  }

  const upcoming = bookings.filter(b => b.status !== 'completed').sort((a, b) => a.date.localeCompare(b.date))

  return (
    <div className="min-h-screen bg-[#F7F5F2]">
      <Navbar />

      <section className="bg-[#2d6a4f] text-white py-16 px-6 lg:px-12 mt-16">
        <div className="max-w-[1440px] mx-auto">
          <Link href="/supplier" className="inline-flex items-center gap-2 text-white/60 hover:text-white text-sm mb-6 transition-colors">
            <ArrowLeft size={16} /> Back to Dashboard
          </Link>
          <h1 className="font-display italic text-4xl lg:text-5xl">Shuttle Fleet</h1>
          <p className="mt-3 text-white/70 font-sans text-lg">
            Manage your vehicles, drivers, permits and guest transfer bookings.
          </p>
        </div>
      </section>

      <main className="max-w-[1440px] mx-auto px-6 lg:px-12 py-12">
        {/* Stats strip */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
          {[
            { label: 'Vehicles', value: vehicles.length },
            { label: 'Verified', value: vehicles.filter(v => v.is_verified).length },
            { label: 'Upcoming Transfers', value: upcoming.length },
            { label: 'Total Passengers', value: upcoming.reduce((s, b) => s + b.passengers, 0) },
          ].map(stat => (
            <div key={stat.label} className="bg-white border border-gray-200 p-5">
              <p className="font-sans text-[10px] tracking-[0.14em] uppercase text-gray-400 mb-1">{stat.label}</p>
              <p className="font-display italic text-3xl text-[#2d6a4f]">{stat.value}</p>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex gap-0 border-b border-gray-200 mb-8">
          {(['fleet', 'bookings', 'schedule'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-6 py-3 font-sans text-sm capitalize border-b-2 transition-colors ${activeTab === tab ? 'border-[#2d6a4f] text-[#2d6a4f] font-medium' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
            >
              {tab === 'fleet' ? 'Fleet' : tab === 'bookings' ? 'Bookings' : 'Schedule'}
            </button>
          ))}
        </div>

        {activeTab === 'fleet' && (
          <>
            <div className="flex items-center justify-between mb-6">
              <p className="font-sans text-gray-600">{vehicles.length} vehicle{vehicles.length !== 1 ? 's' : ''} registered</p>
              <button
                onClick={() => setShowForm(v => !v)}
                className="inline-flex items-center gap-2 bg-[#2d6a4f] text-white px-5 py-2.5 font-sans text-sm font-medium hover:bg-[#235a3f] transition-colors"
              >
                <Plus size={16} /> Register Vehicle
              </button>
            </div>

            {showForm && (
              <div className="bg-white border border-gray-200 p-8 mb-8">
                <h2 className="font-display italic text-2xl text-[#2d6a4f] mb-2">Register New Vehicle</h2>
                <p className="font-sans text-sm text-gray-500 mb-6">All permits are required by the Department of Transport. Your vehicle will be reviewed before activation.</p>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                  {[
                    { key: 'make', label: 'Make *', placeholder: 'Toyota' },
                    { key: 'model', label: 'Model *', placeholder: 'Quantum' },
                    { key: 'year', label: 'Year', placeholder: '2022', type: 'number' },
                    { key: 'registration', label: 'Registration *', placeholder: 'KZN 123 GP' },
                    { key: 'capacity', label: 'Passenger Capacity', placeholder: '14', type: 'number' },
                  ].map(field => (
                    <div key={field.key}>
                      <label className="block font-sans text-xs tracking-[0.12em] uppercase text-gray-500 mb-2">{field.label}</label>
                      <input
                        type={field.type || 'text'}
                        value={(form as any)[field.key]}
                        onChange={e => setForm(f => ({ ...f, [field.key]: e.target.value }))}
                        placeholder={field.placeholder}
                        className="w-full border border-gray-300 px-4 py-3 font-sans text-sm focus:outline-none focus:border-[#2d6a4f]"
                      />
                    </div>
                  ))}
                </div>

                <div className="border-t border-gray-100 pt-6 mb-6">
                  <h3 className="font-sans text-xs tracking-[0.14em] uppercase text-gray-400 mb-4">Required Permits & Licences</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div>
                      <label className="block font-sans text-xs tracking-[0.12em] uppercase text-gray-500 mb-2">DoT Operating Permit No.</label>
                      <input value={form.dot_permit_number} onChange={e => setForm(f => ({ ...f, dot_permit_number: e.target.value }))} placeholder="DOT-KZN-00000" className="w-full border border-gray-300 px-4 py-3 font-sans text-sm focus:outline-none focus:border-[#2d6a4f] mb-2" />
                      <label className="flex items-center gap-2 border border-dashed border-gray-300 px-4 py-2.5 cursor-pointer hover:border-[#2d6a4f] transition-colors">
                        <Upload size={14} className="text-gray-400" />
                        <span className="font-sans text-xs text-gray-500">Upload permit document</span>
                      </label>
                    </div>
                    <div>
                      <label className="block font-sans text-xs tracking-[0.12em] uppercase text-gray-500 mb-2">Public Liability Policy No.</label>
                      <input value={form.pli_policy_number} onChange={e => setForm(f => ({ ...f, pli_policy_number: e.target.value }))} placeholder="PLI-2024-00000" className="w-full border border-gray-300 px-4 py-3 font-sans text-sm focus:outline-none focus:border-[#2d6a4f] mb-2" />
                      <label className="flex items-center gap-2 border border-dashed border-gray-300 px-4 py-2.5 cursor-pointer hover:border-[#2d6a4f] transition-colors">
                        <Upload size={14} className="text-gray-400" />
                        <span className="font-sans text-xs text-gray-500">Upload policy document</span>
                      </label>
                    </div>
                    <div>
                      <label className="block font-sans text-xs tracking-[0.12em] uppercase text-gray-500 mb-2">Tourism Operator's Permit No.</label>
                      <input value={form.tourism_permit_number} onChange={e => setForm(f => ({ ...f, tourism_permit_number: e.target.value }))} placeholder="TBCSA-T-0000" className="w-full border border-gray-300 px-4 py-3 font-sans text-sm focus:outline-none focus:border-[#2d6a4f] mb-2" />
                      <label className="flex items-center gap-2 border border-dashed border-gray-300 px-4 py-2.5 cursor-pointer hover:border-[#2d6a4f] transition-colors">
                        <Upload size={14} className="text-gray-400" />
                        <span className="font-sans text-xs text-gray-500">Upload permit document</span>
                      </label>
                    </div>
                  </div>
                </div>

                <div className="border-t border-gray-100 pt-6 mb-6">
                  <h3 className="font-sans text-xs tracking-[0.14em] uppercase text-gray-400 mb-4">Driver Details</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block font-sans text-xs tracking-[0.12em] uppercase text-gray-500 mb-2">Driver Full Name</label>
                      <input value={form.driver_name} onChange={e => setForm(f => ({ ...f, driver_name: e.target.value }))} placeholder="Full name" className="w-full border border-gray-300 px-4 py-3 font-sans text-sm focus:outline-none focus:border-[#2d6a4f]" />
                    </div>
                    <div>
                      <label className="block font-sans text-xs tracking-[0.12em] uppercase text-gray-500 mb-2">Professional Driving Permit No.</label>
                      <input value={form.driver_pdp_number} onChange={e => setForm(f => ({ ...f, driver_pdp_number: e.target.value }))} placeholder="PDP-2024-KZN-0000" className="w-full border border-gray-300 px-4 py-3 font-sans text-sm focus:outline-none focus:border-[#2d6a4f]" />
                    </div>
                    <div>
                      <label className="flex items-center gap-2 border border-dashed border-gray-300 px-4 py-2.5 cursor-pointer hover:border-[#2d6a4f] transition-colors col-span-2 max-w-xs">
                        <Upload size={14} className="text-gray-400" />
                        <span className="font-sans text-xs text-gray-500">Upload PDP document</span>
                      </label>
                    </div>
                  </div>
                </div>

                <div className="flex gap-3">
                  <button onClick={handleRegister} className="bg-[#2d6a4f] text-white px-6 py-2.5 font-sans text-sm font-medium hover:bg-[#235a3f] transition-colors">
                    Submit for Verification
                  </button>
                  <button onClick={() => setShowForm(false)} className="border border-gray-300 text-gray-700 px-6 py-2.5 font-sans text-sm hover:bg-gray-50 transition-colors">
                    Cancel
                  </button>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {vehicles.map(v => (
                <div key={v.id} className="bg-white border border-gray-200 p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-[#2d6a4f]/10 flex items-center justify-center">
                        <Truck size={22} className="text-[#2d6a4f]" />
                      </div>
                      <div>
                        <h3 className="font-display italic text-xl">{v.year} {v.make} {v.model}</h3>
                        <p className="font-sans text-sm text-gray-500">{v.registration} · {v.capacity} seats</p>
                      </div>
                    </div>
                    {v.is_verified
                      ? <span className="flex items-center gap-1.5 text-[#2d6a4f] bg-[#2d6a4f]/10 px-2.5 py-1 font-sans text-xs"><CheckCircle size={12} /> Verified</span>
                      : <span className="flex items-center gap-1.5 text-[#9a7840] bg-[#C9A96E]/10 px-2.5 py-1 font-sans text-xs"><Clock size={12} /> Pending</span>
                    }
                  </div>
                  <div className="space-y-1.5 mb-4">
                    {v.driver_name && <p className="font-sans text-xs text-gray-500 flex items-center gap-1.5"><User size={12} /> Driver: <span className="text-gray-800">{v.driver_name}</span></p>}
                    {v.dot_permit_number && <p className="font-sans text-xs text-gray-500">DoT: <span className="text-gray-800">{v.dot_permit_number}</span></p>}
                    {v.pli_policy_number && <p className="font-sans text-xs text-gray-500">PLI: <span className="text-gray-800">{v.pli_policy_number}</span></p>}
                    {v.tourism_permit_number && <p className="font-sans text-xs text-gray-500">Tourism: <span className="text-gray-800">{v.tourism_permit_number}</span></p>}
                  </div>
                  <div className="border-t border-gray-100 pt-3 flex justify-end">
                    <button onClick={() => setVehicles(prev => prev.filter(x => x.id !== v.id))} className="inline-flex items-center gap-1.5 text-red-500 hover:text-red-700 font-sans text-sm transition-colors">
                      <Trash2 size={14} /> Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {activeTab === 'bookings' && (
          <div className="space-y-4">
            {bookings.map(b => (
              <div key={b.id} className="bg-white border border-gray-200 p-6 flex items-center justify-between gap-6">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="font-display italic text-lg">{b.guest_name}</h3>
                    <span className={`font-sans text-xs px-2.5 py-1 ${statusConfig[b.status].color}`}>{statusConfig[b.status].label}</span>
                  </div>
                  <div className="flex flex-wrap gap-4 font-sans text-sm text-gray-600">
                    <span className="flex items-center gap-1.5"><MapPin size={13} /> {b.from} → {b.to}</span>
                    <span className="flex items-center gap-1.5"><Calendar size={13} /> {new Date(b.date).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' })} at {b.pickup_time}</span>
                    <span className="flex items-center gap-1.5"><User size={13} /> {b.passengers} passenger{b.passengers !== 1 ? 's' : ''}</span>
                  </div>
                </div>
                <div className="text-right text-xs font-sans text-gray-400">
                  Vehicle: {vehicles.find(v => v.id === b.vehicle_id)?.registration || '—'}
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'schedule' && (
          <div>
            <h2 className="font-display italic text-2xl mb-6">Upcoming Pickup Itinerary</h2>
            {upcoming.length === 0 ? (
              <div className="text-center py-20 bg-white border border-gray-200">
                <Calendar size={40} className="text-gray-300 mx-auto mb-4" />
                <p className="font-sans text-gray-500">No upcoming transfers scheduled.</p>
              </div>
            ) : (
              <div className="relative pl-6 border-l-2 border-[#C9A96E] space-y-6">
                {upcoming.map(b => (
                  <div key={b.id} className="relative">
                    <div className="absolute -left-[29px] top-0 w-4 h-4 bg-[#C9A96E]" />
                    <p className="font-sans text-[10px] tracking-[0.14em] uppercase text-[#9a7840] mb-1">
                      {new Date(b.date).toLocaleDateString('en-ZA', { weekday: 'long', day: 'numeric', month: 'long' })} · {b.pickup_time}
                    </p>
                    <div className="bg-white border border-gray-200 p-5">
                      <p className="font-display italic text-lg mb-1">{b.guest_name}</p>
                      <p className="font-sans text-sm text-gray-600">{b.from} → {b.to} · {b.passengers} pax</p>
                      <p className="font-sans text-xs text-gray-400 mt-2">Vehicle: {vehicles.find(v => v.id === b.vehicle_id)?.make} {vehicles.find(v => v.id === b.vehicle_id)?.model} ({vehicles.find(v => v.id === b.vehicle_id)?.registration})</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      <Footer />
    </div>
  )
}
