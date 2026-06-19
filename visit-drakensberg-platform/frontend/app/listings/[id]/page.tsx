'use client';

import { useState } from 'react';
import BookingWidget from '@/components/booking/BookingWidget';

interface Props {
  params: { id: string };
}

const sampleListing = {
  title: 'Cathedral Peak Mountain Lodge',
  location: 'Cathedral Peak, Northern Drakensberg, KwaZulu-Natal',
  category: 'Lodge',
  price: 1850,
  rating: 4.9,
  reviewCount: 124,
  description:
    'Nestled at the foot of the iconic Cathedral Peak, this luxury mountain lodge offers breathtaking views, world-class hospitality, and unrivalled access to the Drakensberg wilderness. Each suite is designed with natural materials that blend seamlessly into the landscape. Wake to birdsong, hike directly from your door, and return to a crackling fireplace.',
  amenities: [
    { label: 'Swimming Pool', icon: '🏊' },
    { label: 'Free WiFi', icon: '📶' },
    { label: 'Braai Facilities', icon: '🔥' },
    { label: 'Hiking Access', icon: '🥾' },
    { label: 'Restaurant', icon: '🍽️' },
    { label: 'Parking', icon: '🅿️' },
    { label: 'Laundry', icon: '👕' },
    { label: 'Room Service', icon: '🛎️' },
  ],
  images: [
    'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1200',
    'https://images.unsplash.com/photo-1571003123894-1f0594d2b5d9?w=1200',
    'https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?w=1200',
    'https://images.unsplash.com/photo-1470770841072-f978cf4d019e?w=1200',
    'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=1200',
  ],
  host: {
    name: 'Thabo Mokoena',
    since: 'January 2019',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=thabo',
    responseRate: '98%',
    responseTime: 'within an hour',
  },
};

const sampleReviews = [
  {
    id: 'r1',
    author: 'Sarah van der Merwe',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=sarah',
    rating: 5,
    date: 'March 2024',
    text: 'Absolutely stunning lodge! The views of Cathedral Peak from our suite were jaw-dropping. The staff were incredibly welcoming and the food was exceptional. We hiked every day and returned to pure luxury. Will definitely be back.',
  },
  {
    id: 'r2',
    author: 'James Fourie',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=james',
    rating: 5,
    date: 'February 2024',
    text: 'Thabo and his team went above and beyond. The braai evenings were magical under the stars. The hiking trails are right at your doorstep — we did the Cathedral Peak summit on day 2. Highly recommend for any outdoor lovers.',
  },
  {
    id: 'r3',
    author: 'Priya Naidoo',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=priya',
    rating: 4,
    date: 'January 2024',
    text: 'Beautiful property in an incredible location. The pool area was lovely for sundowners. WiFi was a bit spotty in the evenings but honestly, you come here to disconnect anyway. The mountain views more than make up for it.',
  },
];

function StarRating({ rating, max = 5 }: { rating: number; max?: number }) {
  return (
    <span className="flex items-center gap-0.5">
      {Array.from({ length: max }).map((_, i) => (
        <span key={i} className={i < rating ? 'text-yellow-400' : 'text-gray-300'}>
          ★
        </span>
      ))}
    </span>
  );
}

export default function ListingDetailPage({ params }: Props) {
  const [activeImage, setActiveImage] = useState(0);
  const listing = sampleListing;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Breadcrumb */}
      <div className="bg-white border-b border-gray-200 px-4 py-3">
        <div className="max-w-7xl mx-auto flex items-center gap-2 text-sm text-gray-500">
          <a href="/" className="hover:text-[#2D6A4F]">Home</a>
          <span>/</span>
          <a href="/stays" className="hover:text-[#2D6A4F]">{listing.category}s</a>
          <span>/</span>
          <span className="text-gray-800">{listing.title}</span>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Title */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">{listing.title}</h1>
          <div className="flex items-center gap-4 mt-2 text-sm">
            <span className="flex items-center gap-1">
              <StarRating rating={Math.round(listing.rating)} />
              <span className="font-medium text-gray-800 ml-1">{listing.rating}</span>
              <span className="text-gray-500">({listing.reviewCount} reviews)</span>
            </span>
            <span className="text-gray-400">·</span>
            <span className="text-gray-600">{listing.location}</span>
          </div>
        </div>

        {/* Image Gallery */}
        <div className="mb-8">
          <div className="relative h-80 md:h-[480px] overflow-hidden rounded-xl">
            <img
              src={listing.images[activeImage]}
              alt={listing.title}
              className="w-full h-full object-cover transition-opacity duration-300"
            />
          </div>
          <div className="flex gap-2 mt-2 overflow-x-auto pb-1">
            {listing.images.map((img, i) => (
              <button
                key={i}
                onClick={() => setActiveImage(i)}
                className={`relative w-20 h-16 shrink-0 rounded-lg overflow-hidden border-2 transition-colors ${
                  activeImage === i ? 'border-[#2D6A4F]' : 'border-transparent'
                }`}
              >
                <img src={img} alt="" className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        </div>

        <div className="flex gap-8">
          {/* Left: Details */}
          <div className="flex-1 space-y-8">
            {/* Host Card */}
            <div className="bg-white rounded-xl p-6 shadow-sm flex items-center gap-4">
              <img
                src={listing.host.avatar}
                alt={listing.host.name}
                className="w-16 h-16 rounded-full bg-gray-100"
              />
              <div>
                <p className="font-semibold text-gray-800">Hosted by {listing.host.name}</p>
                <p className="text-sm text-gray-500">Member since {listing.host.since}</p>
                <div className="flex gap-4 mt-1 text-xs text-gray-500">
                  <span>✉️ Responds {listing.host.responseTime}</span>
                  <span>📊 {listing.host.responseRate} response rate</span>
                </div>
              </div>
              <button className="ml-auto border border-[#2D6A4F] text-[#2D6A4F] px-4 py-2 rounded-lg text-sm hover:bg-green-50 transition-colors">
                Contact Host
              </button>
            </div>

            {/* Description */}
            <div className="bg-white rounded-xl p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-gray-800 mb-3">About this place</h2>
              <p className="text-gray-600 leading-relaxed">{listing.description}</p>
            </div>

            {/* Amenities */}
            <div className="bg-white rounded-xl p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-gray-800 mb-4">What this place offers</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {listing.amenities.map((a) => (
                  <div key={a.label} className="flex items-center gap-2 text-sm text-gray-700">
                    <span className="text-xl">{a.icon}</span>
                    <span>{a.label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Reviews */}
            <div className="bg-white rounded-xl p-6 shadow-sm">
              <div className="flex items-center gap-3 mb-6">
                <h2 className="text-lg font-semibold text-gray-800">Reviews</h2>
                <span className="flex items-center gap-1 text-sm">
                  <span className="text-yellow-400">★</span>
                  <span className="font-medium">{listing.rating}</span>
                  <span className="text-gray-400">· {listing.reviewCount} reviews</span>
                </span>
              </div>

              <div className="space-y-6">
                {sampleReviews.map((review) => (
                  <div key={review.id} className="border-b border-gray-100 last:border-0 pb-6 last:pb-0">
                    <div className="flex items-center gap-3 mb-2">
                      <img
                        src={review.avatar}
                        alt={review.author}
                        className="w-10 h-10 rounded-full bg-gray-100"
                      />
                      <div>
                        <p className="font-medium text-gray-800 text-sm">{review.author}</p>
                        <p className="text-xs text-gray-500">{review.date}</p>
                      </div>
                      <div className="ml-auto">
                        <StarRating rating={review.rating} />
                      </div>
                    </div>
                    <p className="text-gray-600 text-sm leading-relaxed">{review.text}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right: Booking Widget */}
          <div className="w-80 shrink-0">
            <div className="sticky top-6">
              <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-200">
                <div className="flex items-baseline gap-1 mb-4">
                  <span className="text-2xl font-bold text-gray-900">
                    R{listing.price.toLocaleString()}
                  </span>
                  <span className="text-gray-500 text-sm">/ night</span>
                </div>
                <BookingWidget listing={{ id: params.id, title: listing.title, price_per_unit: listing.price, unit_type: listing.unit_type ?? "per_night", max_guests: listing.max_guests ?? 10 }} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
