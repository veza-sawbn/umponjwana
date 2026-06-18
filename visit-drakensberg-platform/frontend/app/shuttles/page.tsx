'use client';

import { useState } from 'react';

const LOCATIONS = [
  'Durban Airport',
  'Pietermaritzburg',
  'Cathedral Peak',
  'Champagne Valley',
  'Royal Natal',
  'Giants Castle',
  'Sani Pass',
  'Lesotho Border',
];

const VEHICLE_TYPES = ['sedan', 'minibus', 'suv', '4x4'];

const sampleShuttles = [
  {
    id: 's1',
    operator: 'Berg Express Transfers',
    from: 'Durban Airport',
    to: 'Cathedral Peak',
    vehicleType: '4x4',
    passengers: 6,
    price: 1800,
    rating: 4.8,
    reviewCount: 72,
    duration: '3.5 hrs',
    image: 'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?w=800',
  },
  {
    id: 's2',
    operator: 'Sani Shuttle Co.',
    from: 'Pietermaritzburg',
    to: 'Sani Pass',
    vehicleType: '4x4',
    passengers: 4,
    price: 2200,
    rating: 4.9,
    reviewCount: 58,
    duration: '4 hrs',
    image: 'https://images.unsplash.com/photo-1449965408869-eaa3f722e40d?w=800',
  },
  {
    id: 's3',
    operator: 'Drakensberg Transfers',
    from: 'Durban Airport',
    to: 'Champagne Valley',
    vehicleType: 'minibus',
    passengers: 12,
    price: 3500,
    rating: 4.6,
    reviewCount: 34,
    duration: '3 hrs',
    image: 'https://images.unsplash.com/photo-1570125909232-eb263c188f7e?w=800',
  },
  {
    id: 's4',
    operator: 'Royal Berg Cabs',
    from: 'Pietermaritzburg',
    to: 'Royal Natal',
    vehicleType: 'sedan',
    passengers: 4,
    price: 950,
    rating: 4.5,
    reviewCount: 19,
    duration: '2.5 hrs',
    image: 'https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=800',
  },
  {
    id: 's5',
    operator: 'Giants Castle Shuttle',
    from: 'Durban Airport',
    to: 'Giants Castle',
    vehicleType: 'suv',
    passengers: 7,
    price: 2800,
    rating: 4.7,
    reviewCount: 41,
    duration: '4.5 hrs',
    image: 'https://images.unsplash.com/photo-1555215695-3004980ad54e?w=800',
  },
  {
    id: 's6',
    operator: 'Lesotho Link',
    from: 'Sani Pass',
    to: 'Lesotho Border',
    vehicleType: '4x4',
    passengers: 6,
    price: 800,
    rating: 4.9,
    reviewCount: 93,
    duration: '1.5 hrs',
    image: 'https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?w=800',
  },
];

const SORT_OPTIONS = ['Price: Low to High', 'Price: High to Low', 'Rating', 'Most Reviewed'];

const VEHICLE_ICONS: Record<string, string> = {
  sedan: '🚗',
  minibus: '🚌',
  suv: '🚙',
  '4x4': '🛻',
};

export default function ShuttlesPage() {
  const [sortBy, setSortBy] = useState(SORT_OPTIONS[0]);
  const [fromLocation, setFromLocation] = useState('');
  const [toLocation, setToLocation] = useState('');
  const [selectedVehicles, setSelectedVehicles] = useState<string[]>([]);
  const [minPassengers, setMinPassengers] = useState(1);

  const toggleVehicle = (v: string) =>
    setSelectedVehicles((prev) => (prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v]));

  const filtered = [...sampleShuttles]
    .sort((a, b) => {
      if (sortBy === 'Price: Low to High') return a.price - b.price;
      if (sortBy === 'Price: High to Low') return b.price - a.price;
      if (sortBy === 'Rating') return b.rating - a.rating;
      if (sortBy === 'Most Reviewed') return b.reviewCount - a.reviewCount;
      return 0;
    })
    .filter((s) => {
      if (fromLocation && s.from !== fromLocation) return false;
      if (toLocation && s.to !== toLocation) return false;
      if (selectedVehicles.length && !selectedVehicles.includes(s.vehicleType)) return false;
      if (s.passengers < minPassengers) return false;
      return true;
    });

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-gray-800 text-white py-10 px-6">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-3xl font-bold">Shuttles & Transfers</h1>
          <p className="mt-2 text-gray-300">
            Reliable transport to and from all Drakensberg destinations
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8 flex gap-8">
        {/* Sidebar */}
        <aside className="w-72 shrink-0">
          <div className="bg-white rounded-xl shadow-sm p-6 sticky top-6 space-y-6">
            <h2 className="font-semibold text-gray-800 text-lg">Filters</h2>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">From</label>
              <select
                value={fromLocation}
                onChange={(e) => setFromLocation(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-500"
              >
                <option value="">Any location</option>
                {LOCATIONS.map((l) => <option key={l}>{l}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">To</label>
              <select
                value={toLocation}
                onChange={(e) => setToLocation(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-500"
              >
                <option value="">Any destination</option>
                {LOCATIONS.map((l) => <option key={l}>{l}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Vehicle Type</label>
              {VEHICLE_TYPES.map((v) => (
                <label key={v} className="flex items-center gap-2 cursor-pointer mb-1">
                  <input
                    type="checkbox"
                    checked={selectedVehicles.includes(v)}
                    onChange={() => toggleVehicle(v)}
                    className="accent-gray-700"
                  />
                  <span className="text-sm text-gray-600 capitalize">
                    {VEHICLE_ICONS[v]} {v.toUpperCase()}
                  </span>
                </label>
              ))}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Min. passengers: {minPassengers}
              </label>
              <input
                type="range"
                min={1}
                max={20}
                value={minPassengers}
                onChange={(e) => setMinPassengers(Number(e.target.value))}
                className="w-full accent-gray-700"
              />
            </div>

            <button
              onClick={() => {
                setFromLocation('');
                setToLocation('');
                setSelectedVehicles([]);
                setMinPassengers(1);
              }}
              className="w-full text-sm text-gray-600 underline"
            >
              Clear all filters
            </button>
          </div>
        </aside>

        {/* Main */}
        <main className="flex-1">
          <div className="flex items-center justify-between mb-6">
            <p className="text-gray-600 text-sm">
              <span className="font-semibold text-gray-800">{filtered.length}</span> shuttles available
            </p>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-500"
            >
              {SORT_OPTIONS.map((o) => <option key={o}>{o}</option>)}
            </select>
          </div>

          <div className="space-y-4">
            {filtered.map((shuttle) => (
              <a key={shuttle.id} href={`/listings/${shuttle.id}`} className="block group">
                <div className="bg-white rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow flex">
                  <div className="relative w-48 shrink-0 overflow-hidden">
                    <img
                      src={shuttle.image}
                      alt={shuttle.operator}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  </div>
                  <div className="p-4 flex-1">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-semibold text-gray-800">{shuttle.operator}</h3>
                        <p className="text-sm text-gray-600 mt-1">
                          {shuttle.from}
                          <span className="mx-2 text-gray-400">→</span>
                          {shuttle.to}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-gray-900">R{shuttle.price.toLocaleString()}</p>
                        <p className="text-xs text-gray-500">per trip</p>
                      </div>
                    </div>
                    <div className="mt-3 flex gap-4 text-sm">
                      <span className="text-gray-600">
                        {VEHICLE_ICONS[shuttle.vehicleType]} {shuttle.vehicleType.toUpperCase()}
                      </span>
                      <span className="text-gray-600">👥 Up to {shuttle.passengers}</span>
                      <span className="text-gray-600">⏱ {shuttle.duration}</span>
                    </div>
                    <div className="mt-2 flex items-center gap-1 text-sm">
                      <span className="text-yellow-500">★</span>
                      <span className="font-medium text-gray-700">{shuttle.rating}</span>
                      <span className="text-gray-400 text-xs">({shuttle.reviewCount} reviews)</span>
                    </div>
                  </div>
                </div>
              </a>
            ))}
          </div>
        </main>
      </div>
    </div>
  );
}
