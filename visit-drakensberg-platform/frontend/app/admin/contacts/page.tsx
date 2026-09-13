'use client'

import { useState } from 'react'
import { BookUser, Building2 } from 'lucide-react'
import DirectoryContactsPanel from '@/components/admin/contacts/DirectoryContactsPanel'
import SupplierContactsPanel from '@/components/admin/contacts/SupplierContactsPanel'

// Two contact books live here, and they are deliberately separate:
//
//   Directory   the platform's own outreach list — establishments compiled
//               from the regional tourism directories that we want to
//               recruit. No account, no supplier, no booking behind them;
//               segmented by source, sector, region, reachability and where
//               the conversation has got to (vd_directory_contacts).
//   Suppliers   each supplier's own address book of people who actually
//               transacted with them, plus anything imported into it
//               (vd_supplier_contacts). Cross-supplier view — a supplier
//               session only ever sees its own rows.
//
// Registered customers are a third book again, over on /admin/customers.

const TABS = [
  { id: 'directory', label: 'Directory', icon: Building2 },
  { id: 'suppliers', label: 'Supplier Address Books', icon: BookUser },
] as const

export default function AdminContactsPage() {
  const [tab, setTab] = useState<(typeof TABS)[number]['id']>('directory')

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mb-6">
        <p className="font-sans text-[10px] tracking-[0.14em] uppercase text-gray-400 mb-1">Admin Console</p>
        <h1 className="font-display italic text-2xl sm:text-3xl text-[#000000]">Contacts</h1>
      </div>

      <div className="flex gap-1 border-b border-gray-200 mb-6 overflow-x-auto">
        {TABS.map(t => {
          const Icon = t.icon
          const active = tab === t.id
          return (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`inline-flex items-center gap-2 px-4 py-3 font-sans text-sm whitespace-nowrap border-b-2 -mb-px transition-colors ${
                active ? 'border-[#2d6a4f] text-[#2d6a4f]' : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}>
              <Icon size={14} /> {t.label}
            </button>
          )
        })}
      </div>

      {tab === 'directory' ? <DirectoryContactsPanel /> : <SupplierContactsPanel />}
    </div>
  )
}
