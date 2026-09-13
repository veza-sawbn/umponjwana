'use client'

import { Heart } from 'lucide-react'
import { motion } from 'framer-motion'
import toast from 'react-hot-toast'
import { useSavedListings } from '@/lib/saved-listings-context'
import type { SaveableListing } from '@/lib/saved-listings'

/* ────────────────────────────────────────────────────────────────────────────
 * The save control. One component for every listing on the public site —
 * stays, hikes, activities, tours, packages and experiences — so a saved
 * listing looks and behaves the same wherever the visitor meets it.
 *
 * Two variants:
 *   overlay — a round heart that sits on a card's image (the default).
 *   inline  — a bordered "Save" / "Saved" button for a detail page, where
 *             there's room for a word and the action needs to be findable
 *             rather than discovered by hovering.
 * ──────────────────────────────────────────────────────────────────────────── */

type SaveButtonProps = {
  /** The listing to save — id, type, and the snapshot /account/saved renders. */
  listing: SaveableListing
  variant?: 'overlay' | 'inline'
  /** 'dark' is the button sitting ON a dark surface (a hero band, a photo):
   *  translucent white chrome. 'light' is the default white-card treatment. */
  tone?: 'light' | 'dark'
  className?: string
}

export default function SaveButton({
  listing,
  variant = 'overlay',
  tone = 'light',
  className = '',
}: SaveButtonProps) {
  const { isSaved, toggleSaved } = useSavedListings()
  const saved = isSaved(listing.type, listing.id)
  const label = saved ? 'Remove from saved' : `Save ${listing.title}`

  async function handleClick(e: React.MouseEvent) {
    // Every card on this site is a <Link> wrapping its image, so without this
    // the heart navigates to the listing instead of saving it.
    e.preventDefault()
    e.stopPropagation()

    const nowSaved = await toggleSaved(listing)
    toast.success(nowSaved ? 'Saved to your listings' : 'Removed from saved', {
      id: `save-${listing.type}-${listing.id}`,
    })
  }

  if (variant === 'inline') {
    return (
      <button
        type="button"
        onClick={handleClick}
        aria-pressed={saved}
        aria-label={label}
        className={`inline-flex items-center gap-2 border px-4 py-2 font-sans text-sm transition-colors ${
          tone === 'dark'
            ? saved
              ? 'border-white/60 text-white bg-white/15 hover:bg-white/25'
              : 'border-white/25 text-white/70 hover:border-white/60 hover:text-white'
            : saved
              ? 'border-red-400 text-red-500 bg-red-50 hover:bg-red-100'
              : 'border-black/15 text-forest/70 bg-white hover:border-forest hover:text-forest'
        } ${className}`}
      >
        <Heart
          size={15}
          className={saved ? (tone === 'dark' ? 'fill-white text-white' : 'fill-red-500 text-red-500') : ''}
        />
        {saved ? 'Saved' : 'Save'}
      </button>
    )
  }

  return (
    <motion.button
      type="button"
      onClick={handleClick}
      aria-pressed={saved}
      aria-label={label}
      title={saved ? 'Remove from saved' : 'Save for later'}
      whileTap={{ scale: 0.85 }}
      transition={{ duration: 0.1 }}
      className={`absolute top-3 right-3 z-10 w-8 h-8 rounded-full flex items-center justify-center shadow-sm transition-colors ${
        tone === 'dark'
          ? 'bg-black/40 backdrop-blur-sm hover:bg-black/60'
          : 'bg-white/90 backdrop-blur-sm hover:bg-white'
      } ${className}`}
    >
      <Heart
        size={16}
        className={`transition-colors ${
          saved
            ? 'fill-red-500 text-red-500'
            : tone === 'dark' ? 'text-white' : 'text-gray-400'
        }`}
      />
    </motion.button>
  )
}
