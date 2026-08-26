import { formatMoney } from '@/lib/allocation'

type BookingStatus = 'confirmed' | 'pending' | 'cancelled' | 'completed';

interface Booking {
  id: string;
  guest: string;
  listing: string;
  checkIn: string;
  checkOut: string;
  guests: number;
  total: number;
  status: BookingStatus;
}

interface BookingTableProps {
  bookings: Booking[];
}

const STATUS_STYLES: Record<BookingStatus, string> = {
  confirmed: 'bg-green-100 text-green-700',
  pending: 'bg-yellow-100 text-yellow-700',
  cancelled: 'bg-red-100 text-red-700',
  completed: 'bg-gray-100 text-gray-600',
};

export default function BookingTable({ bookings }: BookingTableProps) {
  if (bookings.length === 0) {
    return (
      <div className="text-center py-10 text-gray-400 text-sm">
        No bookings to display.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 border-b border-gray-200">
          <tr>
            {['Booking ID', 'Guest', 'Listing', 'Check-in', 'Check-out', 'Guests', 'Total', 'Status'].map(
              (h) => (
                <th
                  key={h}
                  className="text-left px-4 py-3 text-xs text-gray-500 uppercase tracking-wide font-medium whitespace-nowrap"
                >
                  {h}
                </th>
              )
            )}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 bg-white">
          {bookings.map((b) => (
            <tr key={b.id} className="hover:bg-gray-50 transition-colors">
              <td className="px-4 py-3 font-mono text-xs text-gray-500">#{b.id}</td>
              <td className="px-4 py-3 font-medium text-gray-800">{b.guest}</td>
              <td className="px-4 py-3 text-gray-600 max-w-[160px] truncate">{b.listing}</td>
              <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{b.checkIn}</td>
              <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{b.checkOut}</td>
              <td className="px-4 py-3 text-gray-600">{b.guests}</td>
              <td className="px-4 py-3 font-medium text-gray-800">
                {formatMoney(b.total)}
              </td>
              <td className="px-4 py-3">
                <span
                  className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${STATUS_STYLES[b.status]}`}
                >
                  {b.status}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
