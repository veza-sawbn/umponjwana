'use client'

import { Gift, Star, TrendingUp, Award } from 'lucide-react'

const POINTS = 840

const TIERS = [
  { name: 'Explorer', min: 0, max: 499, color: 'text-gray-500', bg: 'bg-gray-100' },
  { name: 'Adventurer', min: 500, max: 1499, color: 'text-[#C9A96E]', bg: 'bg-[#C9A96E]/15' },
  { name: 'Summit', min: 1500, max: Infinity, color: 'text-[#2d6a4f]', bg: 'bg-[#2d6a4f]/10' },
]

const currentTier = TIERS.find(t => POINTS >= t.min && POINTS <= t.max) || TIERS[0]
const nextTier = TIERS[TIERS.indexOf(currentTier) + 1]
const progressToNext = nextTier ? Math.round(((POINTS - currentTier.min) / (nextTier.min - currentTier.min)) * 100) : 100

const HISTORY = [
  { date: '22 Jun 2026', action: 'Booking: Cathedral Peak Lodge', points: +320, balance: 840 },
  { date: '18 Feb 2026', action: 'Review submitted', points: +50, balance: 520 },
  { date: '15 Feb 2026', action: 'Booking: San Rock Art Tour', points: +120, balance: 470 },
  { date: '10 Apr 2026', action: 'Referral: Lindiwe D.', points: +100, balance: 350 },
  { date: '10 Apr 2026', action: 'Booking: Berg Valley Guesthouse', points: +250, balance: 250 },
]

const REWARDS = [
  { title: '10% Off Next Stay', points: 500, category: 'Accommodation', available: true },
  { title: 'Free Guide Add-On', points: 300, category: 'Activity', available: true },
  { title: 'Priority Booking Access', points: 200, category: 'Platform', available: true },
  { title: 'Complimentary Breakfast', points: 800, category: 'Accommodation', available: false },
  { title: 'Free Activity Upgrade', points: 600, category: 'Activity', available: false },
  { title: 'Summit Tier: Exclusive Packages', points: 1500, category: 'Premium', available: false },
]

export default function LoyaltyPage() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="font-display italic text-3xl text-[#000000]">Loyalty & Rewards</h1>
        <p className="font-sans text-sm text-gray-400 mt-1">Earn points on every booking, review and referral</p>
      </div>

      {/* Points hero */}
      <div className="bg-[#000000] text-white p-8 mb-8">
        <div className="flex items-start justify-between mb-6">
          <div>
            <p className="font-sans text-[10px] tracking-[0.14em] uppercase text-white/40 mb-1">Your Points Balance</p>
            <p className="font-display italic text-6xl text-[#C9A96E]">{POINTS.toLocaleString()}</p>
            <p className="font-sans text-sm text-white/50 mt-1">Berg Loyalty Points</p>
          </div>
          <div className={`${currentTier.bg} px-4 py-2`}>
            <div className="flex items-center gap-2">
              <Award size={16} className={currentTier.color} />
              <div>
                <p className={`font-display italic text-xl ${currentTier.color}`}>{currentTier.name}</p>
                <p className="font-sans text-xs text-white/40">Current tier</p>
              </div>
            </div>
          </div>
        </div>

        {nextTier && (
          <div>
            <div className="flex justify-between font-sans text-xs text-white/50 mb-2">
              <span>{currentTier.name}</span>
              <span>{nextTier.min - POINTS} points to {nextTier.name}</span>
            </div>
            <div className="h-1.5 bg-white/10 overflow-hidden">
              <div className="h-full bg-[#C9A96E] transition-all" style={{ width: `${progressToNext}%` }} />
            </div>
          </div>
        )}
      </div>

      {/* Earn points info */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {[
          { icon: Star, label: 'Per R100 Spent', value: '1 pt', desc: 'On all bookings' },
          { icon: TrendingUp, label: 'Review Bonus', value: '50 pts', desc: 'Per verified review' },
          { icon: Gift, label: 'Referral Reward', value: '100 pts', desc: 'Per referred booking' },
          { icon: Award, label: 'Event Attendance', value: '25 pts', desc: 'Per event ticket' },
        ].map(e => {
          const Icon = e.icon
          return (
            <div key={e.label} className="bg-white border border-gray-200 p-4">
              <Icon size={16} className="text-[#C9A96E] mb-3" />
              <p className="font-display italic text-2xl text-[#000000]">{e.value}</p>
              <p className="font-sans text-[10px] tracking-[0.1em] uppercase text-gray-400 mt-1">{e.label}</p>
              <p className="font-sans text-xs text-gray-400 mt-0.5">{e.desc}</p>
            </div>
          )
        })}
      </div>

      {/* Rewards */}
      <div className="mb-8">
        <h2 className="font-display italic text-2xl text-[#000000] mb-5">Available Rewards</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {REWARDS.map(r => (
            <div key={r.title} className={`bg-white border p-5 ${r.available ? 'border-gray-200' : 'border-gray-100 opacity-50'}`}>
              <span className="font-sans text-[10px] tracking-[0.12em] uppercase text-[#C9A96E] bg-[#C9A96E]/10 px-2 py-0.5">{r.category}</span>
              <p className="font-display italic text-xl text-[#000000] mt-3 mb-1">{r.title}</p>
              <p className="font-display italic text-2xl text-[#2d6a4f] mb-3">{r.points.toLocaleString()} pts</p>
              <button
                disabled={!r.available || POINTS < r.points}
                className={`w-full py-2 font-sans text-sm transition-colors ${
                  r.available && POINTS >= r.points
                    ? 'bg-[#2d6a4f] text-white hover:bg-[#235a3f]'
                    : 'bg-gray-100 text-gray-300 cursor-not-allowed'
                }`}
              >
                {!r.available ? `Unlock at ${r.points.toLocaleString()} pts` : POINTS < r.points ? `Need ${(r.points - POINTS).toLocaleString()} more pts` : 'Redeem'}
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Points history */}
      <div>
        <h2 className="font-display italic text-2xl text-[#000000] mb-5">Points History</h2>
        <div className="bg-white border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                {['Date', 'Activity', 'Points', 'Balance'].map(h => (
                  <th key={h} className="text-left px-5 py-3 font-sans text-[10px] tracking-[0.12em] uppercase text-gray-400">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {HISTORY.map((h, i) => (
                <tr key={i} className="hover:bg-[#F7F5F2] transition-colors">
                  <td className="px-5 py-4 font-sans text-xs text-gray-400">{h.date}</td>
                  <td className="px-5 py-4 font-sans text-sm">{h.action}</td>
                  <td className="px-5 py-4 font-display italic text-[#2d6a4f]">+{h.points}</td>
                  <td className="px-5 py-4 font-sans text-sm text-gray-600">{h.balance.toLocaleString()} pts</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
