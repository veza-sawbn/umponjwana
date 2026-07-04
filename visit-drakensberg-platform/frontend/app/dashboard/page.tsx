import { redirect } from 'next/navigation'

// The visitor account area lives at /account (real bookings, itinerary,
// settings). This route previously showed a hardcoded demo dashboard.
export default function DashboardPage() {
  redirect('/account')
}
