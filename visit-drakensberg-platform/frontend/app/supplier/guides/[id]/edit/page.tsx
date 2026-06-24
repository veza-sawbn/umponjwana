'use client'
import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'

const MOCK: Record<string, { name: string; certs: string; guideNo: string; speciality: string; languages: string; bio: string; emergencyName: string; emergencyPhone: string; status: string }> = {
  '1': { name: 'Bongani Ndlovu',   certs: 'FGASA Level 2, Mountain Guide', guideNo: 'TBCSA-G-0091', speciality: 'Summit Routes',   languages: 'English, Zulu',          bio: 'Born and raised in the Drakensberg foothills. Bongani has been guiding summit hikes for 12 years and holds the Drakensberg peak record for most Cathedral Peak summits in a season.', emergencyName: 'Thandi Ndlovu', emergencyPhone: '+27 82 111 2222', status: 'active' },
  '2': { name: 'Marné du Plessis', certs: 'FGASA Level 1',                 guideNo: 'TBCSA-G-0144', speciality: 'Cultural Tours',  languages: 'Afrikaans, English',     bio: 'Historian and cultural guide with a passion for San rock art. Marné has led over 500 cultural tours through the Drakensberg and Giants Castle.', emergencyName: 'Piet du Plessis', emergencyPhone: '+27 83 222 3333', status: 'active' },
  '3': { name: 'Zanele Mthembu',   certs: 'Wilderness First Aid, FGASA',   guideNo: 'TBCSA-G-0201', speciality: 'Multi-day Hikes', languages: 'English, Zulu, Sotho', bio: 'Zanele specialises in multi-day traverses and is certified in Wilderness First Aid. She has completed the Drakensberg Grand Traverse twice.', emergencyName: 'Sipho Mthembu', emergencyPhone: '+27 84 333 4444', status: 'active' },
}

const STATUSES = ['active', 'on leave', 'inactive']

export default function EditGuidePage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const seed = MOCK[id] ?? MOCK['1']
  const [form, setForm] = useState(seed)
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  return (
    <div className="p-8 max-w-xl">
      <button onClick={() => router.back()} className="font-sans text-sm text-black/40 hover:text-black/70 mb-3 flex items-center gap-1"><ChevronLeft size={14} /> Guides</button>
      <h1 className="font-display italic text-2xl text-black/90 mb-6">Edit Guide</h1>

      <div className="bg-white rounded-xl border border-black/8 p-6 space-y-5">
        <F label="Full Name" required><input value={form.name} onChange={e => set('name', e.target.value)} className={inp} /></F>

        <div className="grid grid-cols-2 gap-4">
          <F label="FGASA / Cert Number"><input value={form.certs} onChange={e => set('certs', e.target.value)} className={inp} /></F>
          <F label="TBCSA Guide Number"><input value={form.guideNo} onChange={e => set('guideNo', e.target.value)} className={inp} /></F>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <F label="Speciality"><input value={form.speciality} onChange={e => set('speciality', e.target.value)} className={inp} /></F>
          <F label="Languages"><input value={form.languages} onChange={e => set('languages', e.target.value)} placeholder="English, Zulu" className={inp} /></F>
        </div>

        <F label="Bio"><textarea value={form.bio} onChange={e => set('bio', e.target.value)} rows={4} className={`${inp} resize-none`} /></F>

        <div className="border-t border-black/6 pt-5 space-y-4">
          <p className="font-sans text-xs font-semibold text-black/40 uppercase tracking-wider">Emergency Contact</p>
          <div className="grid grid-cols-2 gap-4">
            <F label="Name"><input value={form.emergencyName} onChange={e => set('emergencyName', e.target.value)} className={inp} /></F>
            <F label="Phone"><input value={form.emergencyPhone} onChange={e => set('emergencyPhone', e.target.value)} className={inp} /></F>
          </div>
        </div>

        <F label="Status">
          <div className="flex gap-2">
            {STATUSES.map(s => (
              <button key={s} onClick={() => set('status', s)} className={`font-sans text-xs px-3 py-1.5 rounded-full border capitalize transition-colors ${form.status === s ? 'bg-[#C9A96E] text-white border-[#C9A96E]' : 'border-black/15 text-black/60 hover:border-[#C9A96E]/40'}`}>{s}</button>
            ))}
          </div>
        </F>
      </div>

      <div className="flex gap-3 mt-6">
        <button onClick={() => router.push('/supplier/guides')} className="flex-1 bg-[#C9A96E] text-white font-sans text-sm py-2.5 rounded-lg hover:bg-[#b8965d] transition-colors">Save Changes</button>
        <button onClick={() => router.back()} className="font-sans text-sm px-5 py-2.5 border border-black/15 rounded-lg text-black/50">Cancel</button>
      </div>
    </div>
  )
}

const inp = 'w-full font-sans text-sm border border-black/10 rounded-lg px-3 py-2 outline-none focus:border-[#C9A96E]/50 bg-white'
function F({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="font-sans text-sm font-medium text-black/70">{label}{required && <span className="text-[#C9A96E] ml-0.5">*</span>}</label>
      {children}
    </div>
  )
}
