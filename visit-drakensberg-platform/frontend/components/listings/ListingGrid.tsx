'use client'
import { useQuery } from '@tanstack/react-query'
import { listings as listingsApi } from '@/lib/api'
import { ListingCard, ListingCardSkeleton } from './ListingCard'
import { useState } from 'react'
import { Button } from '@/components/ui/Button'

interface ListingGridProps {
  filters?: Record<string, unknown>
  featured?: boolean
}

export default function ListingGrid({ filters = {}, featured = false }: ListingGridProps) {
  const [page, setPage] = useState(1)
  const PAGE_SIZE = 12

  const { data, isLoading, error } = useQuery({
    queryKey: featured ? ['listings', 'featured'] : ['listings', filters, page],
    queryFn: () => featured
      ? listingsApi.getFeatured()
      : listingsApi.search({ ...filters, page, page_size: PAGE_SIZE }),
  })

  if (error) return (
    <div className="text-center py-16 text-gray-500">
      <p>Unable to load listings. Please try again.</p>
    </div>
  )

  const items = data?.items ?? data ?? []
  const total = data?.total ?? items.length
  const hasMore = !featured && (page * PAGE_SIZE) < total

  return (
    <div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
        {isLoading
          ? Array.from({ length: 8 }).map((_, i) => <ListingCardSkeleton key={i} />)
          : items.map((listing: Parameters<typeof ListingCard>[0]['listing']) => (
              <ListingCard key={listing.id} listing={listing} />
            ))
        }
      </div>

      {items.length === 0 && !isLoading && (
        <div className="text-center py-20 text-gray-500">
          <p className="text-lg font-medium">No listings found</p>
          <p className="text-sm mt-1">Try adjusting your filters or search terms.</p>
        </div>
      )}

      {hasMore && (
        <div className="text-center mt-10">
          <Button variant="secondary" onClick={() => setPage(p => p + 1)}>
            Load more
          </Button>
        </div>
      )}
    </div>
  )
}
