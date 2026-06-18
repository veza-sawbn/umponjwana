'use client';

import { useState } from 'react';
import ListingGrid from '@/components/listings/ListingGrid';

const sampleStays = [
  {
    id: '1',
    title: 'Cathedral Peak Mountain Lodge',
    location: 'Cathedral Peak, Drakensberg',
    price: 1850,
    rating: 4.9,
    reviewCount: 124,
    image: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800',
    category: 'lodge',
    amenities: ['pool', 'wifi', 'braai', 'hiking access'],
    guests: 4,
  },
  {
    id: '2',
    title: 'Drakensberg Sun Resort',
    location: 'Central Berg, KZN',
    price: 2400,
    rating: 4.7,
    reviewCount: 89,
    image: 'https://images.unsplash.com/photo-1571003123894-1f0594d2b5d9?w=800',
    category: 'resort',
    amenities: ['pool', 'wifi', 'braai'],
    guests: 6,
  },
  {
    id: '3',
    title: 'Berg Valley Guesthouse',
    location: 'Champagne Valley, Drakensberg',
    price: 980,
    rating: 4.5,
    reviewCount: 56,
    image: 'https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?w=800',
    category: 'guesthouse',
    amenities: ['wifi', 'braai', 'hiking access'],
    guests: 2,
  },
  {
    id: '4',
    title: 'Royal Natal Eco Cabin',
    location: 'Royal Natal Park, Drakensberg',
    price: 650,
    rating: 4.6,
    reviewCount: 41,
    image: 'https://images.unsplash.com/photo-1470770841072-f978cf4d019e?w=800',
    category: 'cabin',
    amenities: ['braai', 'hiking access'],
    guests: 3,
  },
  {
    id: '5',
    title: 'Sani Pass Adventure Camp',
    location: 'Sani Pass, Southern Berg',
    price: 420,
    rating: 4.3,
    reviewCount: 33,
    image: 'https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?w=800',
    category: 'camp',
    amenities: ['braai', 'hiking access'],
    guests: 8,
  },
  {
    id: '6',
    title: 'Giants Castle Boutique Hotel',
    location: 'Giants Castle, Drakensberg',
    price: 3200,
    rating: 5.0,
    reviewCount: 17,
    image: 'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=800',
    category: 'hotel',
    amenities: ['pool', 'wifi', 'braai', 'hiking access'],
    guests: 2,
  },
];

const AMENITIES = ['Pool', 'WiFi', 'Braai', 'Hiking Access'];
const SORT_OPTIONS = ['Price: Low to High', 'Price: High to Low', 'Rating', 'Most Reviewed'];

export default function StaysPage() {
  const [view, setView] = useState<'grid' | 'map'>('grid');
  const [sortBy, setSortBy] = useState(SORT_OPTIONS[0]);
  const [priceRange, setPriceRange] = useState([0, 5000]);
  const [selectedRatings, setSelectedRatings] = useState<number[]>([]);
  const [selectedAmenities, setSelectedAmenities] = useState<string[]>([]);
  const [guests, setGuests] = useState(1);

  const toggleRating = (r: number) =>
    setSelectedRatings((prev) => (prev.includes(r) ? prev.filter((x) => x !== r) : [...prev, r]));

  const toggleAmenity = (a: string) =>
    setSelectedAmenities((prev) =>
      prev.includes(a) ? prev.filter((x) => x !== a) : [...prev, a]
    );

  const sorted = [...sampleStays].sort((a, b) => {
    if (sortBy === 'Price: Low to High') return a.price - b.price;
    if (sortBy === 'Price: High to Low') return b.price - a.price;
    if (sortBy === 'Rating') return b.rating - a.rating;
    if (sortBy === 'Most Reviewed') return b.reviewCount - a.reviewCount;
    return 0;
  });

  const filtered = sorted.filter((s) => {
    if (s.price < priceRange[0] || s.price > priceRange[1]) return false;
    if (selectedRatings.length && !selectedRatings.some((r) => s.rating >= r)) return false;
    if (
      selectedAmenities.length &&
      !selectedAmenities.every((a) => s.amenities.includes(a.toLowerCase()))
    )
      return false;
    if (s.guests < guests) return false;
    return true;
  });

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-[#2D6A4F] text-white py-10 px-6">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-3xl font-bold">Places to Stay</h1>
          <p className="mt-2 text-green-100">
            Discover lodges, resorts, camps and cabins across the Drakensberg
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8 flex gap-8">
        {/* Sidebar Filters */}
        <aside className="w-72 shrink-0">
          <div className="bg-white rounded-xl shadow-sm p-6 sticky top-6 space-y-6">
            <h2 className="font-semibold text-gray-800 text-lg">Filters</h2>

            {/* Price Range */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Price per night
              </label>
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
                onChange={(e) => setPriceRange([priceRange[0], Number(e.target.value)])}
                className="w-full accent-[#2D6A4F]"
              />
            </div>

            {/* Star Rating */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Star Rating</label>
              <div className="space-y-1">
                {[5, 4, 3].map((r) => (
                  <label key={r} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedRatings.includes(r)}
                      onChange={() => toggleRating(r)}
                      className="accent-[#2D6A4F]"
                    />
                    <span className="text-sm text-gray-600">
                      {'★'.repeat(r)}{'☆'.repeat(5 - r)} {r}+
                    </span>
                  </label>
                ))}
              </div>
            </div>

            {/* Amenities */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Amenities</label>
              <div className="space-y-1">
                {AMENITIES.map((a) => (
                  <label key={a} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedAmenities.includes(a)}
                      onChange={() => toggleAmenity(a)}
                      className="accent-[#2D6A4F]"
                    />
                    <span className="text-sm text-gray-600">{a}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Guests */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Guests</label>
              <input
                type="number"
                min={1}
                max={20}
                value={guests}
                onChange={(e) => setGuests(Number(e.target.value))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]"
              />
            </div>

            <button
              onClick={() => {
                setSelectedRatings([]);
                setSelectedAmenities([]);
                setPriceRange([0, 5000]);
                setGuests(1);
              }}
              className="w-full text-sm text-[#2D6A4F] underline"
            >
              Clear all filters
            </button>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1">
          <div className="flex items-center justify-between mb-6">
            <p className="text-gray-600 text-sm">
              <span className="font-semibold text-gray-800">{filtered.length}</span> stays found
            </p>
            <div className="flex items-center gap-3">
              {/* View Toggle */}
              <div className="flex border border-gray-300 rounded-lg overflow-hidden">
                <button
                  onClick={() => setView('grid')}
                  className={`px-3 py-1.5 text-sm ${view === 'grid' ? 'bg-[#2D6A4F] text-white' : 'bg-white text-gray-600'}`}
                >
                  Grid
                </button>
                <button
                  onClick={() => setView('map')}
                  className={`px-3 py-1.5 text-sm ${view === 'map' ? 'bg-[#2D6A4F] text-white' : 'bg-white text-gray-600'}`}
                >
                  Map
                </button>
              </div>
              {/* Sort */}
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]"
              >
                {SORT_OPTIONS.map((o) => (
                  <option key={o}>{o}</option>
                ))}
              </select>
            </div>
          </div>

          {view === 'grid' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {filtered.map((stay) => (
                <a key={stay.id} href={`/listings/${stay.id}`} className="block group">
                  <div className="bg-white rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                    <div className="relative h-48 overflow-hidden">
                      <img
                        src={stay.image}
                        alt={stay.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    </div>
                    <div className="p-4">
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="font-semibold text-gray-800 text-sm">{stay.title}</h3>
                          <p className="text-xs text-gray-500 mt-0.5">{stay.location}</p>
                        </div>
                        <span className="flex items-center gap-1 text-xs font-medium text-gray-700 shrink-0">
                          <span className="text-yellow-500">★</span>
                          {stay.rating}
                        </span>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-1">
                        {stay.amenities.slice(0, 3).map((a) => (
                          <span
                            key={a}
                            className="text-xs bg-green-50 text-[#2D6A4F] px-2 py-0.5 rounded-full"
                          >
                            {a}
                          </span>
                        ))}
                      </div>
                      <p className="mt-3 text-sm">
                        <span className="font-bold text-gray-900">R{stay.price.toLocaleString()}</span>
                        <span className="text-gray-500"> / night</span>
                      </p>
                    </div>
                  </div>
                </a>
              ))}
            </div>
          ) : (
            <div className="bg-gradient-to-br from-blue-100 to-green-100 rounded-xl h-96 flex items-center justify-center border border-gray-200">
              <div className="text-center">
                <p className="text-gray-500 text-sm mb-4">Map view — {filtered.length} stays</p>
                <div className="flex flex-wrap gap-2 justify-center max-w-sm">
                  {filtered.map((s) => (
                    <span
                      key={s.id}
                      className="bg-[#2D6A4F] text-white text-xs px-2 py-1 rounded-full"
                    >
                      📍 {s.title}
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
