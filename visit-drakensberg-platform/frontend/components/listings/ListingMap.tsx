import { formatMoney } from '@/lib/allocation'

interface Listing {
  id: string;
  title: string;
  lat?: number;
  lng?: number;
  price?: number;
  location?: string;
}

interface ListingMapProps {
  listings: Listing[];
}

export default function ListingMap({ listings }: ListingMapProps) {
  return (
    <div
      className="relative w-full h-full min-h-[400px] rounded-xl overflow-hidden border border-gray-200"
      style={{
        background: 'linear-gradient(135deg, #d4edda 0%, #cce5f5 40%, #b8d4e8 70%, #a8c8a0 100%)',
      }}
    >
      {/* Terrain-like decorative elements */}
      <div className="absolute inset-0 opacity-30">
        <div
          className="absolute top-10 left-20 w-40 h-24 rounded-full"
          style={{ background: 'radial-gradient(ellipse, #8fa888 0%, transparent 70%)' }}
        />
        <div
          className="absolute top-24 right-16 w-32 h-20 rounded-full"
          style={{ background: 'radial-gradient(ellipse, #7a9e7e 0%, transparent 70%)' }}
        />
        <div
          className="absolute bottom-16 left-32 w-48 h-28 rounded-full"
          style={{ background: 'radial-gradient(ellipse, #6b8f71 0%, transparent 70%)' }}
        />
      </div>

      {/* Map Label */}
      <div className="absolute top-3 left-3 bg-white bg-opacity-90 rounded-lg px-3 py-1.5 text-xs font-medium text-gray-600 shadow-sm">
        🗺️ Drakensberg Region
      </div>

      {/* Listing Markers */}
      <div className="absolute inset-0 p-6 pt-12">
        {listings.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-gray-500 text-sm bg-white bg-opacity-80 px-4 py-2 rounded-lg">
              No listings to display
            </p>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2 content-start">
            {listings.map((listing, index) => {
              // Pseudo-position based on index for visual spread
              const positions = [
                'top-16 left-1/4', 'top-24 right-1/3', 'bottom-20 left-1/3',
                'top-1/3 right-1/4', 'bottom-1/3 left-1/5', 'top-1/2 right-1/2',
              ];
              const pos = positions[index % positions.length];

              return (
                <div
                  key={listing.id}
                  className={`absolute ${pos} group cursor-pointer`}
                  style={{
                    transform: `translate(${(index * 37) % 60 - 30}px, ${(index * 23) % 40 - 20}px)`,
                  }}
                >
                  {/* Pin */}
                  <div className="relative">
                    <div className="bg-[#2D6A4F] text-white text-xs font-semibold px-2.5 py-1 rounded-full shadow-md whitespace-nowrap flex items-center gap-1 hover:bg-[#245a42] transition-colors">
                      📍
                      {listing.price ? `${formatMoney(listing.price)}` : listing.title.split(' ')[0]}
                    </div>
                    {/* Tooltip */}
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block z-10">
                      <div className="bg-gray-900 text-white text-xs rounded-lg px-3 py-2 whitespace-nowrap shadow-lg">
                        <p className="font-medium">{listing.title}</p>
                        {listing.location && <p className="text-gray-400">{listing.location}</p>}
                        {listing.lat && listing.lng && (
                          <p className="text-gray-500 font-mono text-[10px] mt-0.5">
                            {listing.lat.toFixed(3)}, {listing.lng.toFixed(3)}
                          </p>
                        )}
                      </div>
                      <div className="w-2 h-2 bg-gray-900 rotate-45 mx-auto -mt-1" />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="absolute bottom-3 right-3 bg-white bg-opacity-90 rounded-lg p-2 text-xs text-gray-500 shadow-sm">
        <p className="font-medium text-gray-700 mb-1">Listings ({listings.length})</p>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-full bg-[#2D6A4F]" />
          <span>Available</span>
        </div>
      </div>
    </div>
  );
}
