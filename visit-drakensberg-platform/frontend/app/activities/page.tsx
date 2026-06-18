'use client';

import { useState } from 'react';

const sampleActivities = [
  {
    id: 'a1',
    title: 'Cathedral Peak Guided Hike',
    location: 'Cathedral Peak, Northern Berg',
    price: 650,
    rating: 4.9,
    reviewCount: 88,
    image: 'https://images.unsplash.com/photo-1551632811-561732d1e306?w=800',
    type: 'guided',
    duration: 'full day',
    difficulty: 'moderate',
  },
  {
    id: 'a2',
    title: 'Fly Fishing on the Thukela',
    location: 'Royal Natal, Drakensberg',
    price: 890,
    rating: 4.7,
    reviewCount: 34,
    image: 'https://images.unsplash.com/photo-1504198453898-bc81c78e8a39?w=800',
    type: 'guided',
    duration: 'half day',
    difficulty: 'easy',
  },
  {
    id: 'a3',
    title: 'Rock Climbing – Monk\'s Cowl',
    location: "Monk's Cowl, Central Berg",
    price: 1200,
    rating: 4.8,
    reviewCount: 21,
    image: 'https://images.unsplash.com/photo-1522163182402-834f871fd851?w=800',
    type: 'guided',
    duration: 'full day',
    difficulty: 'hard',
  },
  {
    id: 'a4',
    title: 'Self-Guided San Art Trail',
    location: 'Giants Castle, Drakensberg',
    price: 120,
    rating: 4.5,
    reviewCount: 57,
    image: 'https://images.unsplash.com/photo-1598300042247-d088f8ab3a91?w=800',
    type: 'self-guided',
    duration: 'half day',
    difficulty: 'easy',
  },
  {
    id: 'a5',
    title: 'Sani Pass 4x4 Adventure',
    location: 'Sani Pass, Southern Berg',
    price: 1800,
    rating: 4.9,
    reviewCount: 112,
    image: 'https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=800',
    type: 'guided',
    duration: 'full day',
    difficulty: 'moderate',
  },
  {
    id: 'a6',
    title: 'Multi-Day Drakensberg Traverse',
    location: 'Central & Northern Berg',
    price: 3500,
    rating: 5.0,
    reviewCount: 8,
    image: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=800',
    type: 'guided',
    duration: 'multi-day',
    difficulty: 'extreme',
  },
];

const SORT_OPTIONS = ['Price: Low to High', 'Price: High to Low', 'Rating', 'Most Reviewed'];
const TYPES = ['guided', 'self-guided'];
const DURATIONS = ['half day', 'full day', 'multi-day'];
const DIFFICULTIES = ['easy', 'moderate', 'hard', 'extreme'];

const DIFFICULTY_COLORS: Record<string, string> = {
  easy: 'bg-green-100 text-green-700',
  moderate: 'bg-yellow-100 text-yellow-700',
  hard: 'bg-orange-100 text-orange-700',
  extreme: 'bg-red-100 text-red-700',
};

export default function ActivitiesPage() {
  const [view, setView] = useState<'grid' | 'map'>('grid');
  const [sortBy, setSortBy] = useState(SORT_OPTIONS[0]);
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [selectedDurations, setSelectedDurations] = useState<string[]>([]);
  const [selectedDifficulties, setSelectedDifficulties] = useState<string[]>([]);
  const [priceRange, setPriceRange] = useState([0, 5000]);

  const toggle = (list: string[], setList: (v: string[]) => void, val: string) =>
    setList(list.includes(val) ? list.filter((x) => x !== val) : [...list, val]);

  const filtered = [...sampleActivities]
    .sort((a, b) => {
      if (sortBy === 'Price: Low to High') return a.price - b.price;
      if (sortBy === 'Price: High to Low') return b.price - a.price;
      if (sortBy === 'Rating') return b.rating - a.rating;
      if (sortBy === 'Most Reviewed') return b.reviewCount - a.reviewCount;
      return 0;
    })
    .filter((a) => {
      if (a.price < priceRange[0] || a.price > priceRange[1]) return false;
      if (selectedTypes.length && !selectedTypes.includes(a.type)) return false;
      if (selectedDurations.length && !selectedDurations.includes(a.duration)) return false;
      if (selectedDifficulties.length && !selectedDifficulties.includes(a.difficulty)) return false;
      return true;
    });

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-[#8B5E3C] text-white py-10 px-6">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-3xl font-bold">Activities & Adventures</h1>
          <p className="mt-2 text-orange-100">
            Guided tours, rock climbing, fly fishing and more across the Drakensberg
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8 flex gap-8">
        {/* Sidebar */}
        <aside className="w-72 shrink-0">
          <div className="bg-white rounded-xl shadow-sm p-6 sticky top-6 space-y-6">
            <h2 className="font-semibold text-gray-800 text-lg">Filters</h2>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Price (R)</label>
              <div className="flex items-center gap-2 text-sm text-gray-600 mb-1">
                <span>R{priceRange[0]}</span>
                <span className="mx-auto">–</span>
                <span>R{priceRange[1]}</span>
              </div>
              <input
                type="range"
                min={0}
                max={5000}
                step={100}
                value={priceRange[1]}
                onChange={(e) => setPriceRange([0, Number(e.target.value)])}
                className="w-full accent-[#8B5E3C]"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Type</label>
              {TYPES.map((t) => (
                <label key={t} className="flex items-center gap-2 cursor-pointer mb-1">
                  <input
                    type="checkbox"
                    checked={selectedTypes.includes(t)}
                    onChange={() => toggle(selectedTypes, setSelectedTypes, t)}
                    className="accent-[#8B5E3C]"
                  />
                  <span className="text-sm text-gray-600 capitalize">{t}</span>
                </label>
              ))}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Duration</label>
              {DURATIONS.map((d) => (
                <label key={d} className="flex items-center gap-2 cursor-pointer mb-1">
                  <input
                    type="checkbox"
                    checked={selectedDurations.includes(d)}
                    onChange={() => toggle(selectedDurations, setSelectedDurations, d)}
                    className="accent-[#8B5E3C]"
                  />
                  <span className="text-sm text-gray-600 capitalize">{d}</span>
                </label>
              ))}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Difficulty</label>
              {DIFFICULTIES.map((d) => (
                <label key={d} className="flex items-center gap-2 cursor-pointer mb-1">
                  <input
                    type="checkbox"
                    checked={selectedDifficulties.includes(d)}
                    onChange={() => toggle(selectedDifficulties, setSelectedDifficulties, d)}
                    className="accent-[#8B5E3C]"
                  />
                  <span className="text-sm text-gray-600 capitalize">{d}</span>
                </label>
              ))}
            </div>

            <button
              onClick={() => {
                setSelectedTypes([]);
                setSelectedDurations([]);
                setSelectedDifficulties([]);
                setPriceRange([0, 5000]);
              }}
              className="w-full text-sm text-[#8B5E3C] underline"
            >
              Clear all filters
            </button>
          </div>
        </aside>

        {/* Main */}
        <main className="flex-1">
          <div className="flex items-center justify-between mb-6">
            <p className="text-gray-600 text-sm">
              <span className="font-semibold text-gray-800">{filtered.length}</span> activities found
            </p>
            <div className="flex items-center gap-3">
              <div className="flex border border-gray-300 rounded-lg overflow-hidden">
                <button
                  onClick={() => setView('grid')}
                  className={`px-3 py-1.5 text-sm ${view === 'grid' ? 'bg-[#8B5E3C] text-white' : 'bg-white text-gray-600'}`}
                >
                  Grid
                </button>
                <button
                  onClick={() => setView('map')}
                  className={`px-3 py-1.5 text-sm ${view === 'map' ? 'bg-[#8B5E3C] text-white' : 'bg-white text-gray-600'}`}
                >
                  Map
                </button>
              </div>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#8B5E3C]"
              >
                {SORT_OPTIONS.map((o) => <option key={o}>{o}</option>)}
              </select>
            </div>
          </div>

          {view === 'grid' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {filtered.map((act) => (
                <a key={act.id} href={`/listings/${act.id}`} className="block group">
                  <div className="bg-white rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                    <div className="relative h-48 overflow-hidden">
                      <img
                        src={act.image}
                        alt={act.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                      <span
                        className={`absolute top-3 left-3 text-xs px-2 py-1 rounded-full font-medium ${DIFFICULTY_COLORS[act.difficulty]}`}
                      >
                        {act.difficulty}
                      </span>
                    </div>
                    <div className="p-4">
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="font-semibold text-gray-800 text-sm">{act.title}</h3>
                          <p className="text-xs text-gray-500 mt-0.5">{act.location}</p>
                        </div>
                        <span className="flex items-center gap-1 text-xs font-medium text-gray-700 shrink-0">
                          <span className="text-yellow-500">★</span>
                          {act.rating}
                        </span>
                      </div>
                      <div className="mt-2 flex gap-2">
                        <span className="text-xs bg-orange-50 text-[#8B5E3C] px-2 py-0.5 rounded-full capitalize">
                          {act.type}
                        </span>
                        <span className="text-xs bg-orange-50 text-[#8B5E3C] px-2 py-0.5 rounded-full capitalize">
                          {act.duration}
                        </span>
                      </div>
                      <p className="mt-3 text-sm">
                        <span className="font-bold text-gray-900">R{act.price.toLocaleString()}</span>
                        <span className="text-gray-500"> / person</span>
                      </p>
                    </div>
                  </div>
                </a>
              ))}
            </div>
          ) : (
            <div className="bg-gradient-to-br from-orange-50 to-green-100 rounded-xl h-96 flex items-center justify-center border border-gray-200">
              <div className="text-center">
                <p className="text-gray-500 text-sm mb-4">Map view — {filtered.length} activities</p>
                <div className="flex flex-wrap gap-2 justify-center max-w-sm">
                  {filtered.map((a) => (
                    <span key={a.id} className="bg-[#8B5E3C] text-white text-xs px-2 py-1 rounded-full">
                      📍 {a.title}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
