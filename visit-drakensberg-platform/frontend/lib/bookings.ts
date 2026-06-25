import { supabase } from './auth'
import type { BookingAddon, BookingStay, ShuttleOption } from './booking-context'

export type SavedBooking = {
  id: string
  reference: string
  userId: string
  customerName: string
  customerEmail: string
  customerPhone: string
  specialRequests: string
  region: string
  checkIn: string
  checkOut: string
  nights: number
  guests: number
  stay: BookingStay | null
  addons: BookingAddon[]
  shuttle: ShuttleOption | null
  subtotal: number
  serviceFee: number
  vat: number
  total: number
  status: 'confirmed' | 'cancelled'
  createdAt: string
}

function genRef() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const part = Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
  return `DBK-${part}-KZN`
}

export async function getBookings(): Promise<SavedBooking[]> {
  try {
    const { data } = await supabase.from('site_content').select('value').eq('key', 'bookings').maybeSingle()
    if (data?.value?.items && Array.isArray(data.value.items)) return data.value.items as SavedBooking[]
  } catch {}
  return []
}

async function saveBookings(bookings: SavedBooking[]): Promise<void> {
  await supabase.from('site_content').upsert(
    { key: 'bookings', value: { items: bookings }, updated_at: new Date().toISOString() },
    { onConflict: 'key' },
  )
}

export async function addBooking(booking: Omit<SavedBooking, 'id' | 'reference' | 'createdAt'>): Promise<SavedBooking> {
  const all = await getBookings()
  const newBooking: SavedBooking = {
    ...booking,
    id: `bk-${Date.now()}`,
    reference: genRef(),
    createdAt: new Date().toISOString(),
  }
  await saveBookings([...all, newBooking])
  return newBooking
}

export async function getBookingById(id: string): Promise<SavedBooking | null> {
  const all = await getBookings()
  return all.find(b => b.id === id) ?? null
}

export async function getBookingsByUser(userId: string): Promise<SavedBooking[]> {
  const all = await getBookings()
  return all.filter(b => b.userId === userId).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export async function updateBookingStatus(id: string, status: 'confirmed' | 'cancelled'): Promise<void> {
  const all = await getBookings()
  await saveBookings(all.map(b => b.id === id ? { ...b, status } : b))
}
