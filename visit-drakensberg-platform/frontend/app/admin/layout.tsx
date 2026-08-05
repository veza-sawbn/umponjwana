'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { LogOut, Mountain } from 'lucide-react'
import { signOut } from '@/lib/auth'
import Logo from '@/components/Logo'
import AdminMobileShell from '@/components/admin/AdminMobileShell'
import { ADMIN_NAV, isAdminNavActive } from '@/lib/admin-nav'

// Desktop keeps the fixed sidebar. Below lg the sidebar is hidden and
// AdminMobileShell supplies a top bar, drawer, tab bar and quick-action sheet;
// the padding on <main> matches those bar heights.

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()

  async function handleSignOut() {
    await signOut()
    router.push('/auth/login')
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex">
      {/* Sidebar — desktop only */}
      <aside className="hidden lg:flex w-60 shrink-0 bg-[#111111] border-r border-white/8 flex-col fixed inset-y-0 left-0 z-40">
        {/* Brand */}
        <div className="px-6 py-5 border-b border-white/8">
          <Link href="/" className="flex flex-col gap-2">
            <Logo className="h-4 w-auto text-gold" />
            <p className="font-sans text-[10px] tracking-[0.14em] uppercase text-white/30">Admin Console</p>
          </Link>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {ADMIN_NAV.map(item => {
            const Icon = item.icon
            const active = isAdminNavActive(item, pathname)
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 font-sans text-sm transition-colors ${
                  active
                    ? 'bg-[#C9A96E]/15 text-[#C9A96E]'
                    : 'text-white/50 hover:text-white hover:bg-white/5'
                }`}
              >
                <Icon size={16} className={active ? 'text-[#C9A96E]' : ''} />
                {item.label}
              </Link>
            )
          })}
        </nav>

        {/* Footer */}
        <div className="px-3 py-4 border-t border-white/8">
          <Link href="/" className="flex items-center gap-3 px-3 py-2.5 font-sans text-sm text-white/40 hover:text-white transition-colors">
            <Mountain size={16} /> View Site
          </Link>
          <button
            onClick={handleSignOut}
            className="w-full flex items-center gap-3 px-3 py-2.5 font-sans text-sm text-white/40 hover:text-red-400 transition-colors"
          >
            <LogOut size={16} /> Sign Out
          </button>
        </div>
      </aside>

      {/* Mobile chrome */}
      <AdminMobileShell />

      {/* Main — admin-main clears the mobile tab bar; no-op from lg up */}
      <div className="admin-main flex-1 min-w-0 min-h-screen bg-[#F7F5F2] pt-14 lg:pt-0 lg:ml-60">
        {children}
      </div>
    </div>
  )
}
