import Link from 'next/link'
import { Mountain, Facebook, Instagram, Twitter, Youtube } from 'lucide-react'

const EXPLORE = [
  { href: '/stays', label: 'Stays' },
  { href: '/activities', label: 'Activities' },
  { href: '/hikes', label: 'Hikes' },
  { href: '/shuttles', label: 'Shuttles' },
  { href: '/packages', label: 'Holiday Packages' },
]

const COMPANY = [
  { href: '/about', label: 'About Us' },
  { href: '/contact', label: 'Contact' },
  { href: '/blog', label: 'Blog' },
  { href: '/careers', label: 'Careers' },
]

const LEGAL = [
  { href: '/privacy', label: 'Privacy Policy' },
  { href: '/terms', label: 'Terms of Service' },
  { href: '/cookies', label: 'Cookie Policy' },
]

export default function Footer() {
  return (
    <footer className="bg-primary-700 text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10">
          {/* Brand */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <Mountain className="h-7 w-7 text-sand-200" />
              <span className="font-bold text-lg">Visit Drakensberg</span>
            </div>
            <p className="text-primary-200 text-sm leading-relaxed mb-6">
              Your gateway to the breathtaking Drakensberg — Africa&apos;s premier mountain destination. Book stays, activities, and adventures.
            </p>
            <div className="flex items-center gap-4">
              {[Facebook, Instagram, Twitter, Youtube].map((Icon, i) => (
                <a key={i} href="#" className="text-primary-300 hover:text-white transition-colors">
                  <Icon className="h-5 w-5" />
                </a>
              ))}
            </div>
          </div>

          {/* Explore */}
          <div>
            <h3 className="font-semibold mb-4">Explore</h3>
            <ul className="space-y-2.5">
              {EXPLORE.map(l => (
                <li key={l.href}>
                  <Link href={l.href} className="text-primary-200 hover:text-white text-sm transition-colors">{l.label}</Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Company */}
          <div>
            <h3 className="font-semibold mb-4">Company</h3>
            <ul className="space-y-2.5">
              {COMPANY.map(l => (
                <li key={l.href}>
                  <Link href={l.href} className="text-primary-200 hover:text-white text-sm transition-colors">{l.label}</Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Newsletter */}
          <div>
            <h3 className="font-semibold mb-4">Stay in the loop</h3>
            <p className="text-primary-200 text-sm mb-4">Get deals and travel inspiration delivered to your inbox.</p>
            <form className="flex gap-2" onSubmit={(e) => e.preventDefault()}>
              <input
                type="email"
                placeholder="Your email"
                className="flex-1 rounded-lg px-3 py-2 text-sm text-gray-900 bg-white outline-none focus:ring-2 focus:ring-sand-200"
              />
              <button type="submit" className="bg-sand-200 text-primary-700 font-semibold text-sm px-4 py-2 rounded-lg hover:bg-sand-300 transition-colors whitespace-nowrap">
                Subscribe
              </button>
            </form>
          </div>
        </div>

        <div className="border-t border-primary-600 mt-12 pt-8 flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-primary-300">
          <span>© {new Date().getFullYear()} Visit Drakensberg. All rights reserved.</span>
          <div className="flex items-center gap-6">
            {LEGAL.map(l => (
              <Link key={l.href} href={l.href} className="hover:text-white transition-colors">{l.label}</Link>
            ))}
          </div>
        </div>
      </div>
    </footer>
  )
}
