'use client'

import { useState } from 'react'
import toast from 'react-hot-toast'
import { Building2, Pencil, User, X } from 'lucide-react'
import {
  orderCustomerDetails, updateOrderCustomer, validateCustomerDetails,
  type MasterOrder, type OrderCustomerDetails,
} from '@/lib/orders'

// The customer on a Master Order: who they are, how to reach them, and — for
// a company — the VAT and registration numbers its tax invoice must carry.
// Staff correct these here; the invoice, its PDF and every email read them
// from the order, so a fix shows up everywhere at once.

const label = 'block font-sans text-[10px] tracking-[0.12em] uppercase text-gray-400 mb-1'
const input = 'w-full border border-gray-200 bg-white px-3 py-2.5 sm:py-2 font-sans text-base sm:text-sm focus:outline-none focus:border-[#2d6a4f]'

function Field({ name, value }: { name: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className={label}>{name}</p>
      <p className="font-sans text-sm text-gray-700 break-words whitespace-pre-line">{value || <span className="text-gray-300">—</span>}</p>
    </div>
  )
}

export default function OrderCustomerCard({ order, onSaved }: { order: MasterOrder; onSaved: () => void }) {
  const saved = orderCustomerDetails(order)
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState<OrderCustomerDetails>(saved)
  const [busy, setBusy] = useState(false)

  const set = (patch: Partial<OrderCustomerDetails>) => setForm(f => ({ ...f, ...patch }))

  function open() { setForm(orderCustomerDetails(order)); setEditing(true) }

  async function save() {
    const problem = validateCustomerDetails(form)
    if (problem) { toast.error(problem); return }
    setBusy(true)
    try {
      await updateOrderCustomer(order.id, form)
      toast.success('Customer details saved. The invoice shows them from now on.')
      setEditing(false)
      onSaved()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not save the customer details')
    } finally { setBusy(false) }
  }

  if (!editing) {
    return (
      <div className="bg-white border border-gray-200 p-4 mb-4">
        <div className="flex items-start justify-between gap-3 mb-3">
          <p className="inline-flex items-center gap-1.5 font-sans text-[10px] tracking-[0.12em] uppercase text-gray-400">
            {saved.isCompany ? <Building2 size={12} /> : <User size={12} />}
            {saved.isCompany ? 'Company customer' : 'Customer'}
          </p>
          <button onClick={open} className="inline-flex items-center gap-1.5 font-sans text-xs text-[#2d6a4f] hover:underline">
            <Pencil size={12} /> Edit details
          </button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-3">
          {saved.isCompany && <Field name="Company" value={saved.company} />}
          <Field name={saved.isCompany ? 'Contact person' : 'Name'} value={saved.name} />
          <Field name="Email" value={saved.email} />
          <Field name="Phone" value={saved.phone} />
          {saved.isCompany && <Field name="VAT number" value={saved.vatNumber} />}
          {saved.isCompany && <Field name="Registration number" value={saved.registrationNumber} />}
          <Field name="Billing address" value={saved.address} />
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white border border-[#2d6a4f]/40 p-4 mb-4">
      <div className="flex items-start justify-between gap-3 mb-3">
        <p className="font-sans text-[10px] tracking-[0.12em] uppercase text-gray-400">Edit customer details</p>
        <button onClick={() => setEditing(false)} aria-label="Cancel" className="text-gray-400 hover:text-gray-700"><X size={16} /></button>
      </div>

      <div className="grid grid-cols-2 sm:flex sm:w-fit border border-gray-200 bg-white overflow-hidden mb-4">
        {([[false, 'Individual', User], [true, 'Company', Building2]] as const).map(([isCompany, text, Icon]) => (
          <button key={text} type="button" onClick={() => set({ isCompany })}
            className={`inline-flex items-center justify-center gap-1.5 px-4 py-2.5 sm:py-2 font-sans text-xs transition-colors border-r border-gray-100 last:border-0 ${form.isCompany === isCompany ? 'bg-[#2d6a4f] text-white' : 'text-gray-500 hover:bg-[#F7F5F2]'}`}>
            <Icon size={13} /> {text}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {form.isCompany && (
          <div className="md:col-span-3">
            <label className={label}>Company name</label>
            <input value={form.company} onChange={e => set({ company: e.target.value })} maxLength={200}
              placeholder="e.g. Acme Tours (Pty) Ltd" className={input} />
          </div>
        )}
        <div>
          <label className={label}>{form.isCompany ? 'Contact person' : 'Full name'}</label>
          <input value={form.name} onChange={e => set({ name: e.target.value })} maxLength={200} className={input} />
        </div>
        <div>
          <label className={label}>Email</label>
          <input type="email" value={form.email} onChange={e => set({ email: e.target.value })} maxLength={320} className={input} />
        </div>
        <div>
          <label className={label}>Phone</label>
          <input type="tel" value={form.phone} onChange={e => set({ phone: e.target.value })} maxLength={40}
            placeholder="+27 82 000 0000" className={input} />
        </div>
        {form.isCompany && (
          <>
            <div>
              <label className={label}>VAT number</label>
              <input value={form.vatNumber} onChange={e => set({ vatNumber: e.target.value })} maxLength={30}
                inputMode="text" placeholder="4xxxxxxxxx" className={input} />
            </div>
            <div>
              <label className={label}>Company registration number</label>
              <input value={form.registrationNumber} onChange={e => set({ registrationNumber: e.target.value })} maxLength={40}
                placeholder="2019/123456/07" className={input} />
            </div>
            <div className="hidden md:block" />
          </>
        )}
        <div className="md:col-span-3">
          <label className={label}>Billing address</label>
          <textarea value={form.address} onChange={e => set({ address: e.target.value })} rows={2} maxLength={500}
            placeholder="Street, town, postal code" className={`${input} resize-none`} />
        </div>
      </div>

      <p className="font-sans text-[11px] text-gray-400 mt-3">
        {form.isCompany
          ? 'The company name, VAT and registration numbers and billing address print on the tax invoice. A South African VAT number is 10 digits starting with 4.'
          : 'Changing the email changes where invoices and receipts for this order are sent.'}
      </p>

      <div className="flex gap-2 mt-4">
        <button onClick={save} disabled={busy}
          className={`px-5 py-2.5 font-sans text-sm transition-colors ${busy ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-[#2d6a4f] text-white hover:bg-[#245741]'}`}>
          {busy ? 'Saving…' : 'Save details'}
        </button>
        <button onClick={() => setEditing(false)} disabled={busy} className="px-5 py-2.5 border border-gray-200 font-sans text-sm text-gray-500">
          Cancel
        </button>
      </div>
    </div>
  )
}
