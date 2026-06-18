'use client';

import { useState } from 'react';

const sampleHikes = [
  {
    id: 'h1',
    title: 'Tugela Falls Trail',
    location: 'Royal Natal National Park',
    distance: 14,
    altitude: 3002,
    difficulty: 'hard',
    rating: 4.9,
    reviewCount: 203,
    duration: '7–9 hrs',
    image: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=800',
  },
  {
    id: 'h2',
    title: 'Amphitheatre Walk',
    location: 'Royal Natal, Northern Berg',
    distance: 8,
    altitude: 2377,
    difficulty: 'moderate',
    rating: 4.7,
    reviewCount: 145,
    duration: '4–5 hrs',
    image: 'https://images.unsplash.com/photo-1501854140801-50d01698950b?w=800',
  },
  {
    id: 'h3',
    title: 'Cathedral Peak Summit',
    location: 'Cathedral Peak, Northern Berg',
    distance: 18,
    altitude: 3004,
    difficulty: 'extreme',
    rating: 4.8,
    reviewCount: 67,
    duration: '10–12 hrs',
    image: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800',
  },
  {
    id: 'h4',
    title: 'Blindman\'s Corner Loop',
    location: 'Champagne Valley',
    distance: 5,
    altitude: 1650,
    difficulty: 'easy',
    rating: 4.4,
    reviewCount: 89,
    duration: '2–3 hrs',
    image: 'https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?w=800',
  },
  {
    id: 'h5',
    title: 'Giant\'s Cup Trail',
    location: 'Sani Pass, Southern Berg',
    distance: 60,
    altitude: 2100,
    difficulty: 'moderate',
    rating: 4.9,
    reviewCount: 56,
    duration: '5 days',
    image: 'https://images.unsplash.com/photo-1551632811-561732d1e306?w=800',
  },
  {
    id: 'h6',
    title: 'Drakensberg Garden Loop',
    location: 'Southern Drakensberg',
    distance: 4,
    altitude: 1900,
    difficulty: 'easy',
    rating: 4.3,
    reviewCount: 32,
    duration: '1.5–2 hrs',
    image: 'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=800',
  },
];

const DIFFICULTIES = ['easy', 'moderate', 'hard', 'extreme'];
const SORT_OPTIONS = ['Rating', 'Distance: Short–Long', 'Distance: Long–Short', 'Most Reviewed'];

const DIFFICULTY_COLORS: Record<string, string> = {
  easy: 'bg-green-100 text-green-700 border-green-200',
  moderate: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  hard: 'bg-orange-100 text-orange-700 border-orange-200',
  extreme: 'bg-red-100 text-red-700 border-red-200',
};

export default function HikesPage() {
  const [sortBy, setSortBy] = useState(SORT_OPTIONS[0]);
  const [selectedDifficulties, setSelectedDifficulties] = useState<string[]>([]);
  const [maxDistance, setMaxDistance] = useState(100);
  const [maxAltitude, setMaxAltitude] = useState(4000);

  const toggleDifficulty = (d: string) =>
    setSelectedDifficulties((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]));

  const filtered = [...sampleHikes]
    .sort((a, b) => {
      if (sortBy === 'Rating') return b.rating - a.rating;
      if (sortBy === 'Distance: Short–Long') return a.distance - b.distance;
      if (sortBy === 'Distance: Long–Short') return b.distance - a.distance;
      if (sortBy === 'Most Reviewed') return b.reviewCount - a.reviewCount;
      return 0;
    })
    .filter((h) => {
      if (selectedDifficulties.length && !selectedDifficulties.includes(h.difficulty)) return false;
      if (h.distance > maxDistance) return false;
      if (h.altitude > maxAltitude) return false;
      return true;
    });

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-[#4A90D9] text-white py-10 px-6">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-3xl font-bold">Hiking Trails</h1>
          <p className="mt-2 text-blue-100">
            From easy walks to extreme summit ascents — explore the Berg on foot
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8 flex gap-8">
        {/* Sidebar */}
        <aside className="w-72 shrink-0">
          <div className="bg-white rounded-xl shadow-sm p-6 sticky top-6 space-y-6">
            <h2 className="font-semibold text-gray-800 text-lg">Filters</h2>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Difficulty</label>
              {DIFFICULTIES.map((d) => (
                <label key={d} className="flex items-center gap-2 cursor-pointer mb-1">
                  <input
                    type="checkbox"
                    checked={selectedDifficulties.includes(d)}
                    onChange={() => toggleDifficulty(d)}
                    className="accent-[#4A90D9]"
                  />
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full border capitalize font-medium ${DIFFICULTY_COLORS[d]}`}
                  >
                    {d}
                  </span>
                </label>
              ))}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Max trail length: {maxDistance} km
              </label>
              <input
                type="range"
                min={1}
                max={100}
                value={maxDistance}
                onChange={(e) => setMaxDistance(Number(e.target.value))}
                className="w-full accent-[#4A90D9]"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Max altitude: {maxAltitude.toLocaleString()} m
              </label>
              <input
                type="range"
                min={1000}
                max={4000}
                step={100}
                value={maxAltitude}
                onChange={(e) => setMaxAltitude(Number(e.target.value))}
                className="w-full accent-[#4A90D9]"
              />
            </div>

            <button
              onClick={() => {
                setSelectedDifficulties([]);
                setMaxDistance(100);
                setMaxAltitude(4000);
              }}
              className="w-full text-sm text-[#4A90D9] underline"
            >
              Clear all filters
            </button>
          </div>
        </aside>

        {/* Main */}
        <main className="flex-1">
          <div className="flex items-center justify-between mb-6">
            <p className="text-gray-600 text-sm">
              <span className="font-semibold text-gray-800">{filtered.length}</span> trails found
            </p>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#4A90D9]"
            >
              {SORT_OPTIONS.map((o) => <option key={o}>{o}</option>)}
            </select>
          </div>

          <div className="space-y-4">
            {filtered.map((hike) => (
              <a key={hike.id} href={`/listings/${hike.id}`} className="block group">
                <div className="bg-white rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow flex">
                  <div className="relative w-48 shrink-0 overflow-hidden">
                    <img
                      src={hike.image}
                      alt={hike.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  </div>
                  <div className="p-4 flex-1">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-semibold text-gray-800">{hike.title}</h3>
                        <p className="text-xs text-gray-500 mt-0.5">{hike.location}</p>
                      </div>
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full border capitalize font-medium ${DIFFICULTY_COLORS[hike.difficulty]}`}
                      >
                        {hike.difficulty}
                      </span>
                    </div>
                    <div className="mt-3 grid grid-cols-3 gap-4 text-sm">
                      <div>
                        <p className="text-xs text-gray-500">Distance</p>
                        <p className="font-medium text-gray-800">{hike.distance} km</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Peak altitude</p>
                        <p className="font-medium text-gray-800">{hike.altitude.toLocaleString()} m</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Duration</p>
                        <p className="font-medium text-gray-800">{hike.duration}</p>
                      </div>
                    </div>
                    <div className="mt-3 flex items-center gap-1 text-sm">
                      <span className="text-yellow-500">★</span>
                      <span className="font-medium text-gray-700">{hike.rating}</span>
                      <span className="text-gray-400 text-xs">({hike.reviewCount} reviews)</span>
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
