import Link from 'next/link'
import { SearchBar } from '@/components/search/SearchBar'
import { ListingCard } from '@/components/listings/ListingCard'
import { Mountain, Tent, Footprints, Car, Package, Star, Shield, MapPin } from 'lucide-react'

const categories = [
  { name: 'Stays', href: '/stays', icon: Tent, desc: 'Lodges, hotels & camping' },
  { name: 'Activities', href: '/activities', icon: Mountain, desc: 'Guided tours & adventures' },
  { name: 'Hikes', href: '/hikes', icon: Footprints, desc: 'Trails & guided walks' },
  { name: 'Shuttles', href: '/shuttles', icon: Car, desc: 'Airport & regional transfers' },
  { name: 'Packages', href: '/packages', icon: Package, desc: 'Multi-day holiday deals' },
]

const featuredListings = [
  {
    id: '1',
    title: 'Cathedral Peak Hotel',
    location: 'Cathedral Peak, KwaZulu-Natal',
    price: 2800,
    unit: 'per night',
    rating: 4.9,
    reviewCount: 312,
    category: 'stay' as const,
    image: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800',
    isFeatured: true,
  },
  {
    id: '2',
    title: 'Giants Castle Hike — Full Day',
    location: 'Giants Castle Reserve',
    price: 650,
    unit: 'per person',
    rating: 4.8,
    reviewCount: 89,
    category: 'hike' as const,
    image: 'https://images.unsplash.com/photo-1551632811-561732d1e306?w=800',
    isFeatured: true,
  },
  {
    id: '3',
    title: 'Royal Natal Guided Trail',
    location: 'Royal Natal National Park',
    price: 450,
    unit: 'per person',
    rating: 4.7,
    reviewCount: 156,
    category: 'activity' as const,
    image: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=800',
    isFeatured: false,
  },
  {
    id: '4',
    title: 'Drakensberg Sun Resort',
    location: 'Central Berg, KwaZulu-Natal',
    price: 1950,
    unit: 'per night',
    rating: 4.6,
    reviewCount: 204,
    category: 'stay' as const,
    image: 'https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=800',
    isFeatured: false,
  },
]

const testimonials = [
  { name: 'Sarah M.', location: 'Cape Town', text: 'Booking our Drakensberg hike was seamless. The lodge was spectacular.', rating: 5 },
  { name: 'James K.', location: 'Johannesburg', text: 'Found an incredible package deal. The shuttle service was punctual and friendly.', rating: 5 },
  { name: 'Priya N.', location: 'Durban', text: 'The activities section had options I didn\'t know existed. Amazing experience!', rating: 5 },
]

export default function HomePage() {
  return (
    <main>
      {/* Hero */}
      <section
        className="relative min-h-[600px] flex items-center justify-center"
        style={{
          backgroundImage: 'linear-gradient(rgba(0,0,0,0.45), rgba(0,0,0,0.55)), url(https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=1600)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
        <div className="text-center text-white px-4 w-full max-w-5xl mx-auto">
          <h1 className="text-5xl md:text-6xl font-bold mb-4 drop-shadow-lg">
            Discover the Drakensberg
          </h1>
          <p className="text-xl md:text-2xl mb-10 text-sand-100 drop-shadow">
            Book stays, hikes, activities & shuttles across South Africa&apos;s most breathtaking mountain range
          </p>
          <div className="bg-white rounded-2xl shadow-2xl p-4">
            <SearchBar />
          </div>
        </div>
      </section>

      {/* Categories */}
      <section className="max-w-7xl mx-auto px-4 py-16">
        <h2 className="text-3xl font-bold text-gray-800 mb-2 text-center">What are you looking for?</h2>
        <p className="text-center text-gray-500 mb-10">Explore everything the Drakensberg has to offer</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          {categories.map((cat) => (
            <Link
              key={cat.name}
              href={cat.href}
              className="group flex flex-col items-center p-6 bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md hover:border-primary transition-all duration-200"
            >
              <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mb-3 group-hover:bg-primary/20 transition-colors">
                <cat.icon className="w-7 h-7 text-primary" />
              </div>
              <span className="font-semibold text-gray-800">{cat.name}</span>
              <span className="text-xs text-gray-500 text-center mt-1">{cat.desc}</span>
            </Link>
          ))}
        </div>
      </section>

      {/* Featured Listings */}
      <section className="bg-gray-50 py-16">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-3xl font-bold text-gray-800">Featured Experiences</h2>
              <p className="text-gray-500 mt-1">Hand-picked by our Drakensberg experts</p>
            </div>
            <Link href="/stays" className="text-primary font-medium hover:underline hidden md:block">
              View all →
            </Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {featuredListings.map((listing) => (
              <ListingCard key={listing.id} listing={listing} />
            ))}
          </div>
        </div>
      </section>

      {/* Why Visit */}
      <section className="max-w-7xl mx-auto px-4 py-16">
        <h2 className="text-3xl font-bold text-gray-800 mb-10 text-center">Why book with us?</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {[
            { icon: Shield, title: 'Secure Booking', desc: 'All payments processed securely via Stripe. Instant confirmation.' },
            { icon: Star, title: 'Verified Reviews', desc: 'Every review is from a real guest who completed their booking.' },
            { icon: MapPin, title: 'Local Expertise', desc: 'Curated by locals who know every trail, lodge, and hidden gem.' },
          ].map((item) => (
            <div key={item.title} className="text-center p-8 rounded-2xl bg-white border border-gray-100 shadow-sm">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <item.icon className="w-8 h-8 text-primary" />
              </div>
              <h3 className="text-xl font-bold text-gray-800 mb-2">{item.title}</h3>
              <p className="text-gray-500">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Testimonials */}
      <section className="bg-primary py-16">
        <div className="max-w-7xl mx-auto px-4">
          <h2 className="text-3xl font-bold text-white mb-10 text-center">What guests say</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {testimonials.map((t) => (
              <div key={t.name} className="bg-white/10 backdrop-blur rounded-2xl p-6 text-white">
                <div className="flex mb-3">
                  {Array.from({ length: t.rating }).map((_, i) => (
                    <Star key={i} className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                  ))}
                </div>
                <p className="text-white/90 mb-4 italic">&quot;{t.text}&quot;</p>
                <p className="font-semibold">{t.name} <span className="text-white/60 font-normal">— {t.location}</span></p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Newsletter */}
      <section className="max-w-2xl mx-auto px-4 py-16 text-center">
        <h2 className="text-3xl font-bold text-gray-800 mb-2">Get Drakensberg deals</h2>
        <p className="text-gray-500 mb-6">Subscribe for exclusive offers, seasonal packages, and travel tips.</p>
        <form className="flex gap-3 max-w-md mx-auto">
          <input
            type="email"
            placeholder="Your email address"
            className="flex-1 px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary"
          />
          <button type="submit" className="px-6 py-3 bg-primary text-white rounded-xl font-semibold hover:bg-primary/90 transition-colors">
            Subscribe
          </button>
        </form>
      </section>
    </main>
  )
}
