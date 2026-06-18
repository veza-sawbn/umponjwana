'use client';

import { useState } from 'react';

const samplePackages = [
  {
    id: 'p1',
    title: 'Cathedral Peak Weekend Escape',
    location: 'Cathedral Peak, Northern Berg',
    duration: 'weekend',
    price: 4500,
    priceUnit: 'per person',
    rating: 4.9,
    reviewCount: 43,
    groupSize: { min: 2, max: 10 },
    includes: ['accommodation', 'meals', 'activities'],
    highlights: ['Guided summit hike', '2 nights lodge', 'All meals included', 'Equipment provided'],
    image: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800',
  },
  {
    id: 'p2',
    title: 'Sani Pass Highlander Week',
    location: 'Sani Pass, Southern Berg',
    duration: 'week',
    price: 12800,
    priceUnit: 'per person',
    rating: 5.0,
    reviewCount: 18,
    groupSize: { min: 4, max: 12 },
    includes: ['accommodation', 'meals', 'activities'],
    highlights: ['4x4 Sani Pass trip', 'Lesotho visit', '7 nights', 'All meals & transfers'],
    image: 'https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?w=800',
  },
  {
    id: 'p3',
    title: 'Berg & Bush Family Holiday',
    location: 'Champagne Valley',
    duration: 'week',
    price: 8900,
    priceUnit: 'per family',
    rating: 4.7,
    reviewCount: 34,
    groupSize: { min: 2, max: 6 },
    includes: ['accommodation', 'activities'],
    highlights: ['Family lodge', 'Kids activities', 'Swimming pool', 'Guided nature walks'],
    image: 'https://images.unsplash.com/photo-1571003123894-1f0594d2b5d9?w=800',
  },
  {
    id: 'p4',
    title: 'Romantic Berg Retreat',
    location: 'Giants Castle',
    duration: 'weekend',
    price: 6200,
    priceUnit: 'per couple',
    rating: 4.8,
    reviewCount: 27,
    groupSize: { min: 2, max: 2 },
    includes: ['accommodation', 'meals'],
    highlights: ['Luxury suite', 'Candlelit dinners', 'Spa access', 'Champagne on arrival'],
    image: 'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=800',
  },
  {
    id: 'p5',
    title: 'Custom Corporate Retreat',
    location: 'Central Drakensberg',
    duration: 'custom',
    price: 2200,
    priceUnit: 'per person/day',
    rating: 4.6,
    reviewCount: 11,
    groupSize: { min: 10, max: 50 },
    includes: ['accommodation', 'meals', 'activities'],
    highlights: ['Conference facilities', 'Team-building hikes', 'Catering', 'Transfers'],
    image: 'https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?w=800',
  },
  {
    id: 'p6',
    title: 'Solo Adventurer Pass',
    location: 'All Berg Regions',
    duration: 'custom',
    price: 980,
    priceUnit: 'per person/day',
    rating: 4.5,
    reviewCount: 22,
    groupSize: { min: 1, max: 1 },
    includes: ['accommodation', 'activities'],
    highlights: ['Flexible itinerary', 'Guided hikes', 'Hostel accommodation', 'Trail maps'],
    image: 'https://images.unsplash.com/photo-1551632811-561732d1e306?w=800',
  },
];

const DURATIONS = ['weekend', 'week', 'custom'];
const INCLUDES_OPTIONS = ['accommodation', 'meals', 'activities'];
const SORT_OPTIONS = ['Price: Low to High', 'Price: High to Low', 'Rating', 'Most Reviewed'];

export default function PackagesPage() {
  const [sortBy, setSortBy] = useState(SORT_OPTIONS[0]);
  const [selectedDurations, setSelectedDurations] = useState<string[]>([]);
  const [selectedIncludes, setSelectedIncludes] = useState<string[]>([]);
  const [maxGroupSize, setMaxGroupSize] = useState(50);

  const toggle = (list: string[], setList: (v: string[]) => void, val: string) =>
    setList(list.includes(val) ? list.filter((x) => x !== val) : [...list, val]);

  const filtered = [...samplePackages]
    .sort((a, b) => {
      if (sortBy === 'Price: Low to High') return a.price - b.price;
      if (sortBy === 'Price: High to Low') return b.price - a.price;
      if (sortBy === 'Rating') return b.rating - a.rating;
      if (sortBy === 'Most Reviewed') return b.reviewCount - a.reviewCount;
      return 0;
    })
    .filter((p) => {
      if (selectedDurations.length && !selectedDurations.includes(p.duration)) return false;
      if (selectedIncludes.length && !selectedIncludes.every((i) => p.includes.includes(i))) return false;
      if (p.groupSize.max > maxGroupSize) return false;
      return true;
    });

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-[#2D6A4F] text-white py-10 px-6">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-3xl font-bold">Holiday Packages</h1>
          <p className="mt-2 text-green-100">
            Curated experiences — accommodation, activities and more bundled for you
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8 flex gap-8">
        {/* Sidebar */}
        <aside className="w-72 shrink-0">
          <div className="bg-white rounded-xl shadow-sm p-6 sticky top-6 space-y-6">
            <h2 className="font-semibold text-gray-800 text-lg">Filters</h2>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Duration</label>
              {DURATIONS.map((d) => (
                <label key={d} className="flex items-center gap-2 cursor-pointer mb-1">
                  <input
                    type="checkbox"
                    checked={selectedDurations.includes(d)}
                    onChange={() => toggle(selectedDurations, setSelectedDurations, d)}
                    className="accent-[#2D6A4F]"
                  />
                  <span className="text-sm text-gray-600 capitalize">{d}</span>
                </label>
              ))}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Includes</label>
              {INCLUDES_OPTIONS.map((i) => (
                <label key={i} className="flex items-center gap-2 cursor-pointer mb-1">
                  <input
                    type="checkbox"
                    checked={selectedIncludes.includes(i)}
                    onChange={() => toggle(selectedIncludes, setSelectedIncludes, i)}
                    className="accent-[#2D6A4F]"
                  />
                  <span className="text-sm text-gray-600 capitalize">{i}</span>
                </label>
              ))}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Max group size: {maxGroupSize}
              </label>
              <input
                type="range"
                min={1}
                max={50}
                value={maxGroupSize}
                onChange={(e) => setMaxGroupSize(Number(e.target.value))}
                className="w-full accent-[#2D6A4F]"
              />
            </div>

            <button
              onClick={() => {
                setSelectedDurations([]);
                setSelectedIncludes([]);
                setMaxGroupSize(50);
              }}
              className="w-full text-sm text-[#2D6A4F] underline"
            >
              Clear all filters
            </button>
          </div>
        </aside>

        {/* Main */}
        <main className="flex-1">
          <div className="flex items-center justify-between mb-6">
            <p className="text-gray-600 text-sm">
              <span className="font-semibold text-gray-800">{filtered.length}</span> packages found
            </p>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]"
            >
              {SORT_OPTIONS.map((o) => <option key={o}>{o}</option>)}
            </select>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {filtered.map((pkg) => (
              <a key={pkg.id} href={`/listings/${pkg.id}`} className="block group">
                <div className="bg-white rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                  <div className="relative h-52 overflow-hidden">
                    <img
                      src={pkg.image}
                      alt={pkg.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    <span className="absolute top-3 left-3 bg-[#2D6A4F] text-white text-xs px-2 py-1 rounded-full capitalize">
                      {pkg.duration}
                    </span>
                  </div>
                  <div className="p-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-semibold text-gray-800">{pkg.title}</h3>
                        <p className="text-xs text-gray-500 mt-0.5">{pkg.location}</p>
                      </div>
                      <span className="flex items-center gap-1 text-xs font-medium text-gray-700 shrink-0">
                        <span className="text-yellow-500">★</span>
                        {pkg.rating}
                      </span>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-1">
                      {pkg.includes.map((i) => (
                        <span
                          key={i}
                          className="text-xs bg-green-50 text-[#2D6A4F] px-2 py-0.5 rounded-full capitalize"
                        >
                          ✓ {i}
                        </span>
                      ))}
                    </div>

                    <ul className="mt-3 space-y-1">
                      {pkg.highlights.slice(0, 2).map((h) => (
                        <li key={h} className="text-xs text-gray-600 flex items-center gap-1">
                          <span className="text-[#2D6A4F]">•</span> {h}
                        </li>
                      ))}
                    </ul>

                    <div className="mt-3 flex items-center justify-between">
                      <p className="text-sm">
                        <span className="font-bold text-gray-900">R{pkg.price.toLocaleString()}</span>
                        <span className="text-gray-500 text-xs"> {pkg.priceUnit}</span>
                      </p>
                      <p className="text-xs text-gray-500">
                        Group: {pkg.groupSize.min}–{pkg.groupSize.max} people
                      </p>
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
