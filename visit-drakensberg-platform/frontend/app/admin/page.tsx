'use client';

import { useState } from 'react';

const stats = [
  { title: 'Total Users', value: '1,248', icon: '👥', trend: '+12% this month' },
  { title: 'Total Suppliers', value: '87', icon: '🏡', trend: '+5 pending approval' },
  { title: 'Total Bookings', value: '3,421', icon: '📅', trend: '+23% this month' },
  { title: 'Total Revenue', value: 'R2.4M', icon: '💰', trend: '+18% this month' },
];

const pendingSuppliers = [
  {
    id: 'sup1',
    name: 'Nomvula Khumalo',
    email: 'nomvula@bergescapes.co.za',
    businessName: 'Berg Escapes',
    listings: 3,
    submitted: '14 Jun 2024',
  },
  {
    id: 'sup2',
    name: 'Danie Botha',
    email: 'danie@saniadventures.co.za',
    businessName: 'Sani Adventures',
    listings: 2,
    submitted: '12 Jun 2024',
  },
  {
    id: 'sup3',
    name: 'Ayanda Mthembu',
    email: 'ayanda@royalbergtours.co.za',
    businessName: 'Royal Berg Tours',
    listings: 5,
    submitted: '10 Jun 2024',
  },
];

const recentBookings = [
  { id: 'BK1001', guest: 'Sarah van der Merwe', listing: 'Cathedral Peak Lodge', total: 8214, status: 'confirmed' },
  { id: 'BK1002', guest: 'James Fourie', listing: 'Sani Pass Camp', total: 3360, status: 'completed' },
  { id: 'BK1003', guest: 'Priya Naidoo', listing: 'Berg Valley Guest', total: 2940, status: 'pending' },
  { id: 'BK1004', guest: 'Lindiwe Dlamini', listing: 'Giants Castle Hotel', total: 18500, status: 'confirmed' },
  { id: 'BK1005', guest: 'Mike Peterson', listing: 'Royal Natal Cabin', total: 1950, status: 'cancelled' },
];

const STATUS_STYLES: Record<string, string> = {
  confirmed: 'bg-green-100 text-green-700',
  completed: 'bg-gray-100 text-gray-600',
  pending: 'bg-yellow-100 text-yellow-700',
  cancelled: 'bg-red-100 text-red-700',
};

export default function AdminPage() {
  const [suppliers, setSuppliers] = useState(pendingSuppliers);

  const handleApprove = (id: string) =>
    setSuppliers((prev) => prev.filter((s) => s.id !== id));

  const handleReject = (id: string) => {
    if (!confirm('Reject this supplier application?')) return;
    setSuppliers((prev) => prev.filter((s) => s.id !== id));
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gray-900 text-white py-10 px-6">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-2xl font-bold">Admin Dashboard</h1>
          <p className="text-gray-400 text-sm mt-1">
            Visit Drakensberg platform management
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8 space-y-8">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {stats.map((s) => (
            <div key={s.title} className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">{s.title}</p>
                <span className="text-2xl">{s.icon}</span>
              </div>
              <p className="text-2xl font-bold text-gray-900">{s.value}</p>
              <p className="text-xs text-green-600 mt-1">{s.trend}</p>
            </div>
          ))}
        </div>

        {/* Pending Verifications */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-800">
              Pending Supplier Verifications
              {suppliers.length > 0 && (
                <span className="ml-2 bg-yellow-100 text-yellow-700 text-xs px-2 py-0.5 rounded-full">
                  {suppliers.length}
                </span>
              )}
            </h2>
          </div>

          {suppliers.length === 0 ? (
            <div className="bg-white rounded-xl p-8 text-center text-gray-400 text-sm shadow-sm">
              ✅ All supplier applications have been reviewed.
            </div>
          ) : (
            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    {['Supplier', 'Business', 'Listings', 'Submitted', 'Actions'].map((h) => (
                      <th
                        key={h}
                        className="text-left px-4 py-3 text-xs text-gray-500 uppercase tracking-wide font-medium"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {suppliers.map((sup) => (
                    <tr key={sup.id} className="hover:bg-gray-50">
                      <td className="px-4 py-4">
                        <p className="font-medium text-gray-800">{sup.name}</p>
                        <p className="text-xs text-gray-500">{sup.email}</p>
                      </td>
                      <td className="px-4 py-4 text-gray-700">{sup.businessName}</td>
                      <td className="px-4 py-4 text-gray-700">{sup.listings}</td>
                      <td className="px-4 py-4 text-gray-500">{sup.submitted}</td>
                      <td className="px-4 py-4">
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleApprove(sup.id)}
                            className="bg-[#2D6A4F] text-white px-3 py-1 rounded-lg text-xs font-medium hover:bg-[#245a42] transition-colors"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => handleReject(sup.id)}
                            className="border border-red-300 text-red-500 px-3 py-1 rounded-lg text-xs font-medium hover:bg-red-50 transition-colors"
                          >
                            Reject
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Recent Bookings */}
        <div>
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Recent Bookings</h2>
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {['ID', 'Guest', 'Listing', 'Total', 'Status'].map((h) => (
                    <th
                      key={h}
                      className="text-left px-4 py-3 text-xs text-gray-500 uppercase tracking-wide font-medium"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {recentBookings.map((b) => (
                  <tr key={b.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono text-xs text-gray-500">#{b.id}</td>
                    <td className="px-4 py-3 font-medium text-gray-800">{b.guest}</td>
                    <td className="px-4 py-3 text-gray-600">{b.listing}</td>
                    <td className="px-4 py-3 font-medium text-gray-800">
                      R{b.total.toLocaleString()}
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
        </div>
      </div>
    </div>
  );
}
