'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Zap, Plus, Clock, Users, Trash2 } from 'lucide-react'
import { supabase } from '@/lib/auth'
import { getActivitiesBySupplier, deleteActivity, type Activity } from '@/lib/activities'

export default function ActivitiesPage() {
  const [activities, setActivities] = useState<Activity[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { setLoading(false); return }
      getActivitiesBySupplier(user.id).then(a => {
        setActivities(a)
        setLoading(false)
      })
    })
  }, [])

  async function handleDelete(id: string) {
    if (!confirm('Remove this activity?')) return
    await deleteActivity(id)
    setActivities(prev => prev.filter(a => a.id !== id))
  }

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Zap size={20} className="text-[#C9A96E]" />
          <h1 className="font-display italic text-2xl text-black/90">Activities</h1>
        </div>
        <Link href="/supplier/activities/new" className="flex items-center gap-2 bg-[#C9A96E] text-white font-sans text-sm px-4 py-2 rounded-lg hover:bg-[#b8965d] transition-colors">
          <Plus size={15} /> Add Activity
        </Link>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-6 h-6 border-2 border-[#C9A96E] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : activities.length === 0 ? (
        <div className="bg-white rounded-xl border border-black/8 py-16 text-center">
          <Zap size={28} className="text-black/15 mx-auto mb-3" />
          <p className="font-sans text-sm text-black/30">No activities yet — add your first activity to get started.</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {activities.map(a => (
            <div key={a.id} className="bg-white rounded-xl border border-black/8 p-5 flex items-center gap-4">
              <div className="w-12 h-12 rounded-lg bg-[#C9A96E]/10 flex items-center justify-center shrink-0">
                <Zap size={18} className="text-[#C9A96E]" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-sans font-semibold text-black/90 truncate">{a.name}</p>
                <div className="flex items-center gap-4 mt-1">
                  <span className="font-sans text-xs text-black/40">{a.category}</span>
                  {a.durationH > 0 && (
                    <span className="font-sans text-xs text-black/40 flex items-center gap-1"><Clock size={11} /> {a.durationH}h{a.durationM > 0 ? ` ${a.durationM}m` : ''}</span>
                  )}
                  <span className="font-sans text-xs text-black/40 flex items-center gap-1"><Users size={11} /> max {a.maxGroup}</span>
                  {a.pricePerPerson > 0 && <span className="font-sans text-xs text-black/40">R{a.pricePerPerson.toLocaleString()} pp</span>}
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span className={`font-sans text-xs px-2 py-0.5 rounded-full capitalize ${a.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>{a.status}</span>
                <Link href={`/supplier/activities/${a.id}/edit`} className="font-sans text-xs text-[#C9A96E] hover:underline">Edit</Link>
                <button onClick={() => handleDelete(a.id)} className="text-red-400 hover:text-red-600">
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
