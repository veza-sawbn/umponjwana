'use client'
import { Star } from 'lucide-react'
import { cn } from '@/lib/utils'

interface StarRatingProps {
  value: number
  max?: number
  interactive?: boolean
  onChange?: (value: number) => void
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const sizes = { sm: 'h-3 w-3', md: 'h-4 w-4', lg: 'h-5 w-5' }

export function StarRating({ value, max = 5, interactive, onChange, size = 'md', className }: StarRatingProps) {
  return (
    <div className={cn('flex items-center gap-0.5', className)}>
      {Array.from({ length: max }).map((_, i) => (
        <Star
          key={i}
          className={cn(
            sizes[size],
            i < value ? 'fill-amber-400 text-amber-400' : 'fill-gray-200 text-gray-200',
            interactive && 'cursor-pointer hover:scale-110 transition-transform',
          )}
          onClick={() => interactive && onChange?.(i + 1)}
        />
      ))}
    </div>
  )
}
