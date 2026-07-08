'use client'
import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import { Users, Plus, Mountain, Star, CheckCircle, Clock, XCircle, User } from 'lucide-react'
import { supabase } from '@/lib/auth'
import {
  getSupplierEntities, addSupplierEntity, deleteSupplierEntity, type SupplierEntity,
} from '@/lib/supplier-entities'

type Guide = SupplierEntity & {
  name: string; certs: string; guideNo: string; speciality: string; languages: string; rating: number; tours: number; status: 'verified' | 'pending' | 'rejected'
}

const ENTITY = 'guides'

const STATUS: Record<Guide['status'], { label: string; Icon: typeof CheckCircle; cls: string }> = {
  verified: { label: 'Verified',        Icon: CheckCircle, cls: 'bg-emerald-100 text-emerald-700' },
  pending:  { label: 'Pending Review',  Icon: Clock,       cls: 'bg-amber-100 text-amber-700'   },
  rejected: { label: 'Rejected',        Icon: XCircle,     cls: 'bg-red-100 text-red-600'       },
}

export default function GuidesPage() {
  const [guides, setGuides] = useState<Guide[]>([])
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState({
    name: '', certs: '', guideNo: '', speciality: '', languages: '',
    qualifications: '', yearsExperience: '', highestSummit: '', completedExpeditions: '', portrait: '', bio: '',
  })
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (user) setGuides(await getSupplierEntities<Guide>(ENTITY, user.id))
      setLoading(false)
    })
  }, [])

  async function add() {
    if (!form.name.trim()) { toast.error('The guide\'s full name is required.'); return }
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('no session')
      const saved = await addSupplierEntity<Guide>(ENTITY, {
        supplierId: user.id,
        name: form.name, certs: form.certs, guideNo: form.guideNo,
        speciality: form.speciality, languages: form.languages,
        qualifications: form.qualifications,
        yearsExperience: Number(form.yearsExperience) || 0,
        highestSummit: form.highestSummit,
        completedExpeditions: Number(form.completedExpeditions) || 0,
        portrait: form.portrait, bio: form.bio,
        rating: 0, tours: 0, status: 'pending', blocked: [],
      } as unknown as Omit<Guide, 'id' | 'createdAt'>)
      setGuides(g => [...g, saved])
      setForm({ name: '', certs: '', guideNo: '', speciality: '', languages: '', qualifications: '', yearsExperience: '', highestSummit: '', completedExpeditions: '', portrait: '', bio: '' })
      setAdding(false)
      toast.success('Guide registered.')
    } catch {
      toast.error('Could not register the guide. Please try again.')
    }
  }

  async function remove(id: string) {
    const prev = guides
    setGuides(gs => gs.filter(x => x.id !== id))
    try {
      await deleteSupplierEntity(ENTITY, id)
    } catch {
      setGuides(prev)
      toast.error('Could not remove the guide. Please try again.')
    }
  }

  return (
    <div className="p-4 sm:p-8 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Users size={20} className="text-[#C9A96E]" />
          <h1 className="font-display italic text-2xl text-black/90">Guides</h1>
        </div>
        <button onClick={() => setAdding(v => !v)} className="flex items-center gap-2 bg-[#C9A96E] text-white font-sans text-sm px-4 py-2 rounded-lg hover:bg-[#b8965d] transition-colors">
          <Plus size={15} /> Add Guide
        </button>
      </div>

      {adding && (
        <div className="bg-white rounded-xl border border-black/8 p-6 space-y-4">
          <p className="font-sans font-semibold text-black/80">Register New Guide</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <F label="Full Name" required><input value={form.name} onChange={e => set('name', e.target.value)} className={inp} /></F>
            <F label="FGASA / Cert Number"><input value={form.certs} onChange={e => set('certs', e.target.value)} className={inp} /></F>
            <F label="TBCSA Guide Number"><input value={form.guideNo} onChange={e => set('guideNo', e.target.value)} className={inp} /></F>
            <F label="Speciality"><input value={form.speciality} onChange={e => set('speciality', e.target.value)} className={inp} /></F>
            <F label="Languages"><input value={form.languages} onChange={e => set('languages', e.target.value)} placeholder="English, Zulu" className={inp} /></F>
            <F label="Qualifications"><input value={form.qualifications} onChange={e => set('qualifications', e.target.value)} placeholder="FGASA Level 3, Wilderness First Responder" className={inp} /></F>
            <F label="Years of Experience"><input type="number" min="0" value={form.yearsExperience} onChange={e => set('yearsExperience', e.target.value)} className={inp} /></F>
            <F label="Highest Summit"><input value={form.highestSummit} onChange={e => set('highestSummit', e.target.value)} placeholder="e.g. Mafadi (3,450m)" className={inp} /></F>
            <F label="Completed Expeditions"><input type="number" min="0" value={form.completedExpeditions} onChange={e => set('completedExpeditions', e.target.value)} className={inp} /></F>
            <F label="Portrait URL"><input value={form.portrait} onChange={e => set('portrait', e.target.value)} placeholder="https://…" className={inp} /></F>
          </div>
          <F label="Biography"><textarea rows={3} value={form.bio} onChange={e => set('bio', e.target.value)} className={`${inp} resize-none`} placeholder="Shown on the guide's public profile…" /></F>
          <p className="font-sans text-xs text-black/40">Guides will be reviewed within 2–3 business days before appearing publicly.</p>
          <div className="flex gap-3">
            <button onClick={add} className="bg-[#C9A96E] text-white font-sans text-sm px-4 py-2 rounded-lg hover:bg-[#b8965d]">Register Guide</button>
            <button onClick={() => setAdding(false)} className="font-sans text-sm px-4 py-2 border border-black/10 rounded-lg text-black/50 hover:border-black/20">Cancel</button>
          </div>
        </div>
      )}

      <div className="grid gap-3">
        {guides.map(g => {
          const s = STATUS[g.status as Guide['status']] ?? STATUS.pending
          const Icon = s.Icon
          return (
            <div key={g.id} className="bg-white rounded-xl border border-black/8 p-5 flex flex-wrap items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-[#C9A96E]/10 flex items-center justify-center shrink-0">
                <span className="font-sans text-sm font-semibold text-[#C9A96E]">{g.name.split(' ').map(n => n[0]).join('')}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-sans font-semibold text-black/90">{g.name}</p>
                <p className="font-sans text-xs text-black/40 mt-0.5">{g.certs}</p>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1">
                  {g.speciality && <span className="font-sans text-xs text-black/40 flex items-center gap-1"><Mountain size={11} /> {g.speciality}</span>}
                  {g.tours > 0 && <span className="font-sans text-xs text-black/40 flex items-center gap-1"><Star size={11} /> {g.rating} · {g.tours} tours</span>}
                  {g.languages && <span className="font-sans text-xs text-black/40">{g.languages}</span>}
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span className={`font-sans text-xs px-2 py-0.5 rounded-full flex items-center gap-1 ${s.cls}`}><Icon size={10} /> {s.label}</span>
                <button onClick={() => remove(g.id)} className="font-sans text-xs text-red-400 hover:text-red-600">Remove</button>
              </div>
            </div>
          )
        })}
        {loading && (
          <p className="font-sans text-sm text-black/30 py-8 text-center">Loading guides…</p>
        )}
        {!loading && guides.length === 0 && (
          <div className="bg-white rounded-xl border border-black/8 py-16 text-center">
            <User size={32} className="text-black/15 mx-auto mb-3" />
            <p className="font-sans text-sm text-black/30">No guides registered yet</p>
          </div>
        )}
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
