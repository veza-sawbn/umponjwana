import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { format, differenceInCalendarDays } from 'date-fns'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number, currency = 'ZAR') {
  return new Intl.NumberFormat('en-ZA', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

export function formatDate(date: Date | string, fmt = 'dd MMM yyyy') {
  return format(new Date(date), fmt)
}

export function calculateNights(checkIn: Date | string, checkOut: Date | string) {
  return Math.max(1, differenceInCalendarDays(new Date(checkOut), new Date(checkIn)))
}

export function calculateServiceFee(subtotal: number) {
  return Math.round(subtotal * 0.1)
}

export function truncateText(text: string, maxLength: number) {
  if (text.length <= maxLength) return text
  return text.slice(0, maxLength).trimEnd() + '…'
}

export function getStatusColor(status: string) {
  const map: Record<string, string> = {
    pending: 'bg-yellow-100 text-yellow-800',
    confirmed: 'bg-green-100 text-green-800',
    cancelled: 'bg-red-100 text-red-800',
    completed: 'bg-gray-100 text-gray-700',
    paid: 'bg-blue-100 text-blue-800',
    refunded: 'bg-purple-100 text-purple-800',
  }
  return map[status] ?? 'bg-gray-100 text-gray-700'
}

export function getCategorySlug(category: string) {
  const map: Record<string, string> = {
    stay: 'stays',
    activity: 'activities',
    hike: 'hikes',
    shuttle: 'shuttles',
    package: 'packages',
  }
  return map[category] ?? category
}
