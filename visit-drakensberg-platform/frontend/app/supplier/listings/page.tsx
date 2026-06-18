'use client';

import { useState } from 'react';
import Link from 'next/link';

interface Listing {
  id: string;
  title: string;
  category: string;
  price: number;
  priceUnit: string;
  status: 'active' | 'inactive';
  bookings: number;
  rating: number;
  image: string;
}

const initialListings: Listing[] = [
  {
    id: 'l1',
    title: 'Cathedral Peak Mountain Lodge',
    category: 'Lodge',
    price: 1850,
    priceUnit: 'per night',
    status: 'active',
    bookings: 24,
    rating: 4.9,
    image: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=200',
  },
  {
    id: 'l2',
    title: 'Berg Valley Guesthouse',
    category: 'Guesthouse',
    price: 980,
    priceUnit: 'per night',
    status: 'active',
    bookings: 11,
    rating: 4.5,
    image: 'https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?w=200',
  },
  {
    id: 'l3',
    title: 'Cathedral Peak Guided Summit Hike',
    category: 'Activity',
    price: 1200,
    priceUnit: 'per person',
    status: 'inactive',
    bookings: 6,
    rating: 4.8,
    image: 'https://images.unsplash.com/photo-1551632811-561732d1e306?w=200',
  },
];

export default function SupplierListingsPage() {
  const [listings, setListings] = useState<Listing[]>(initialListings);

  const toggleStatus = (id: string) => {
    setListings((prev) =>
      prev.map((l) =>
        l.id === id ? { ...l, status: l.status === 'active' ? 'inactive' : 'active' } : l
      )
    );
  };

  const deleteListing = (id: string) => {
    if (!confirm('Delete this listing? This cannot be undone.')) return;
    setListings((prev) => prev.filter((l) => l.id !== id));
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-[#2D6A4F] text-white py-10 px-6">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Link href="/supplier" className="text-green-200 hover:text-white text-sm">
                ← Dashboard
              </Link>
            </div>
            <h1 className="text-2xl font-bold">My Listings</h1>
            <p className="text-green-100 text-sm mt-1">Manage and update your property listings</p>
          </div>
          <Link
            href="/supplier/listings/new"
            className="bg-white text-[#2D6A4F] px-4 py-2.5 rounded-lg font-semibold text-sm hover:bg-green-50 transition-colors"
          >
            + New Listing
          </Link>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {['Listing', 'Category', 'Price', 'Status', 'Bookings', 'Rating', 'Actions'].map(
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
              <tbody className="divide-y divide-gray-100">
                {listings.map((listing) => (
                  <tr key={listing.id} className="hover:bg-gray-50 transition-colors">
                    {/* Listing */}
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-lg overflow-hidden shrink-0">
                          <img
                            src={listing.image}
                            alt={listing.title}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <p className="font-medium text-gray-800">{listing.title}</p>
                      </div>
                    </td>

                    {/* Category */}
                    <td className="px-4 py-4">
                      <span className="bg-green-50 text-[#2D6A4F] text-xs px-2 py-0.5 rounded-full">
                        {listing.category}
                      </span>
                    </td>

                    {/* Price */}
                    <td className="px-4 py-4 text-gray-800 whitespace-nowrap">
                      <span className="font-medium">R{listing.price.toLocaleString()}</span>
                      <span className="text-gray-400 text-xs"> {listing.priceUnit}</span>
                    </td>

                    {/* Status toggle */}
                    <td className="px-4 py-4">
                      <button
                        onClick={() => toggleStatus(listing.id)}
                        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                          listing.status === 'active' ? 'bg-[#2D6A4F]' : 'bg-gray-300'
                        }`}
                        title={listing.status === 'active' ? 'Click to deactivate' : 'Click to activate'}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                            listing.status === 'active' ? 'translate-x-4' : 'translate-x-0.5'
                          }`}
                        />
                      </button>
                      <span
                        className={`ml-2 text-xs capitalize ${
                          listing.status === 'active' ? 'text-green-600' : 'text-gray-400'
                        }`}
                      >
                        {listing.status}
                      </span>
                    </td>

                    {/* Bookings */}
                    <td className="px-4 py-4 text-gray-700">{listing.bookings}</td>

                    {/* Rating */}
                    <td className="px-4 py-4">
                      <span className="flex items-center gap-1 text-gray-700">
                        <span className="text-yellow-400">★</span>
                        {listing.rating}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-3">
                        <Link
                          href={`/supplier/listings/${listing.id}/edit`}
                          className="text-xs text-[#2D6A4F] underline hover:no-underline"
                        >
                          Edit
                        </Link>
                        <Link
                          href={`/listings/${listing.id}`}
                          className="text-xs text-gray-500 underline hover:no-underline"
                        >
                          View
                        </Link>
                        <button
                          onClick={() => deleteListing(listing.id)}
                          className="text-xs text-red-400 underline hover:no-underline"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {listings.length === 0 && (
            <div className="text-center py-16">
              <p className="text-gray-400 text-sm mb-3">You have no listings yet.</p>
              <Link
                href="/supplier/listings/new"
                className="bg-[#2D6A4F] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#245a42] transition-colors"
              >
                Create Your First Listing
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
