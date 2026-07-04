'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Bell, Check } from 'lucide-react'
import {
  getMyNotifications, getUnreadCount, markAllNotificationsRead, markNotificationRead,
  type Notification,
} from '@/lib/notifications'

function timeAgo(iso: string) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  return `${Math.floor(s / 86400)}d ago`
}

// Bell + dropdown listing the signed-in user's notifications.
// `dark` renders for the supplier sidebar; light for visitor pages.
export default function NotificationsBell({ dark = false }: { dark?: boolean }) {
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<Notification[]>([])
  const [unread, setUnread] = useState(0)
  const ref = useRef<HTMLDivElement>(null)

  async function refresh() {
    setUnread(await getUnreadCount())
  }

  useEffect(() => {
    refresh()
    const t = setInterval(refresh, 30_000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  async function toggle() {
    const next = !open
    setOpen(next)
    if (next) setItems(await getMyNotifications())
  }

  async function onItemClick(n: Notification) {
    if (!n.read) {
      await markNotificationRead(n.id)
      setItems(prev => prev.map(x => x.id === n.id ? { ...x, read: true } : x))
      setUnread(u => Math.max(0, u - 1))
    }
    setOpen(false)
  }

  async function readAll() {
    await markAllNotificationsRead()
    setItems(prev => prev.map(x => ({ ...x, read: true })))
    setUnread(0)
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={toggle}
        aria-label={unread > 0 ? `Notifications (${unread} unread)` : 'Notifications'}
        className={`relative p-2 transition-colors ${dark ? 'text-white/50 hover:text-white' : 'text-gray-400 hover:text-[#2d6a4f]'}`}
      >
        <Bell size={17} />
        {unread > 0 && (
          <span className="absolute top-0.5 right-0.5 min-w-[15px] h-[15px] px-0.5 rounded-full bg-[#C9A96E] text-[#000000] text-[9px] font-bold flex items-center justify-center">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 max-h-[420px] overflow-y-auto bg-white border border-black/10 shadow-lg z-50">
          <div className="flex items-center justify-between px-4 py-3 border-b border-black/6">
            <p className="font-sans text-xs tracking-[0.12em] uppercase text-gray-400">Notifications</p>
            {unread > 0 && (
              <button onClick={readAll} className="inline-flex items-center gap-1 font-sans text-xs text-[#2d6a4f] hover:underline">
                <Check size={11} /> Mark all read
              </button>
            )}
          </div>
          {items.length === 0 ? (
            <p className="px-4 py-8 font-sans text-sm text-gray-400 text-center">No notifications yet.</p>
          ) : items.map(n => {
            const inner = (
              <div className={`px-4 py-3 border-b border-black/5 last:border-0 hover:bg-[#F7F5F2] transition-colors ${n.read ? 'opacity-60' : ''}`}>
                <div className="flex items-start gap-2">
                  {!n.read && <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-[#C9A96E] shrink-0" />}
                  <div className="min-w-0">
                    <p className="font-sans text-sm text-gray-800 font-medium leading-snug">{n.title}</p>
                    <p className="font-sans text-xs text-gray-500 mt-0.5 leading-snug">{n.body}</p>
                    <p className="font-sans text-[10px] text-gray-400 mt-1">{timeAgo(n.createdAt)}</p>
                  </div>
                </div>
              </div>
            )
            return n.link ? (
              <Link key={n.id} href={n.link} onClick={() => onItemClick(n)} className="block">{inner}</Link>
            ) : (
              <button key={n.id} onClick={() => onItemClick(n)} className="block w-full text-left">{inner}</button>
            )
          })}
        </div>
      )}
    </div>
  )
}
