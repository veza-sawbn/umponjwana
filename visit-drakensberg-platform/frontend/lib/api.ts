import axios from 'axios'
import { supabase } from './auth'

// Route all API calls through the Next.js server-side proxy to avoid browser CORS blocks.
// Paths in this file start with /api/v1/... which the proxy forwards verbatim to Render.
// Server-side (SSR/RSC) we hit Render directly since there's no CORS constraint there.
const baseURL =
  typeof window !== 'undefined'
    ? '/api/backend'
    : (process.env.NEXT_PUBLIC_API_URL || 'https://visit-drakensberg.onrender.com').replace(/\/+$/, '')

const api = axios.create({
  baseURL,
  headers: { 'Content-Type': 'application/json' },
})

api.interceptors.request.use(async (config) => {
  const { data: { session } } = await supabase.auth.getSession()
  if (session?.access_token) {
    config.headers.Authorization = `Bearer ${session.access_token}`
  }
  return config
})

api.interceptors.response.use(
  (res) => res,
  (error) => {
    if (error.response?.status === 401 && typeof window !== 'undefined') {
      window.location.href = '/auth/login'
    }
    return Promise.reject(error)
  }
)

export const listings = {
  search: (params: Record<string, unknown>) => api.get('/api/v1/listings', { params }).then(r => r.data),
  getById: (id: string) => api.get(`/api/v1/listings/${id}`).then(r => r.data),
  getFeatured: () => api.get('/api/v1/listings/featured').then(r => r.data),
  getCategories: () => api.get('/api/v1/listings/categories').then(r => r.data),
  checkAvailability: (id: string, check_in: string, check_out: string) =>
    api.post(`/api/v1/listings/${id}/availability`, { check_in, check_out }).then(r => r.data),
  create: (data: unknown) => api.post('/api/v1/listings', data).then(r => r.data),
  update: (id: string, data: unknown) => api.put(`/api/v1/listings/${id}`, data).then(r => r.data),
  delete: (id: string) => api.delete(`/api/v1/listings/${id}`).then(r => r.data),
}

export const bookings = {
  create: (data: unknown) => api.post('/api/v1/bookings', data).then(r => r.data),
  getMyBookings: () => api.get('/api/v1/bookings/my-bookings').then(r => r.data),
  getById: (id: string) => api.get(`/api/v1/bookings/${id}`).then(r => r.data),
  cancel: (id: string) => api.put(`/api/v1/bookings/${id}/cancel`).then(r => r.data),
  getSupplierBookings: () => api.get('/api/v1/bookings/supplier/bookings').then(r => r.data),
}

export const payments = {
  createIntent: (booking_id: string, amount: number) =>
    api.post('/api/v1/payments/create-intent', { booking_id, amount }).then(r => r.data),
  confirm: (booking_id: string, payment_intent_id: string) =>
    api.post(`/api/v1/payments/confirm/${booking_id}`, { payment_intent_id }).then(r => r.data),
  getForBooking: (booking_id: string) => api.get(`/api/v1/payments/booking/${booking_id}`).then(r => r.data),
}

export const reviews = {
  getForListing: (listing_id: string) => api.get(`/api/v1/reviews/listing/${listing_id}`).then(r => r.data),
  create: (data: unknown) => api.post('/api/v1/reviews', data).then(r => r.data),
  delete: (id: string) => api.delete(`/api/v1/reviews/${id}`).then(r => r.data),
}

export const suppliers = {
  getMe: () => api.get('/api/v1/suppliers/me').then(r => r.data),
  updateMe: (data: unknown) => api.put('/api/v1/suppliers/me', data).then(r => r.data),
  getStats: () => api.get('/api/v1/suppliers/me/stats').then(r => r.data),
  register: (data: unknown) => api.post('/api/v1/suppliers', data).then(r => r.data),
}

export const notifications = {
  getAll: () => api.get('/api/v1/notifications').then(r => r.data),
  markRead: (id: string) => api.put(`/api/v1/notifications/${id}/read`).then(r => r.data),
  markAllRead: () => api.put('/api/v1/notifications/read-all').then(r => r.data),
  delete: (id: string) => api.delete(`/api/v1/notifications/${id}`).then(r => r.data),
}

export const admin = {
  getStats: () => api.get('/api/v1/admin/dashboard/stats').then(r => r.data),
  getUsers: (params?: Record<string, unknown>) => api.get('/api/v1/admin/users', { params }).then(r => r.data),
  getSuppliers: (params?: Record<string, unknown>) => api.get('/api/v1/admin/suppliers', { params }).then(r => r.data),
  getListings: (params?: Record<string, unknown>) => api.get('/api/v1/admin/listings', { params }).then(r => r.data),
  getBookings: (params?: Record<string, unknown>) => api.get('/api/v1/admin/bookings', { params }).then(r => r.data),
  verifySupplier: (id: string) => api.put(`/api/v1/admin/suppliers/${id}/verify`).then(r => r.data),
  featureListing: (id: string) => api.put(`/api/v1/admin/listings/${id}/feature`).then(r => r.data),
  deleteListing: (id: string) => api.delete(`/api/v1/admin/listings/${id}`).then(r => r.data),
}

export default api
