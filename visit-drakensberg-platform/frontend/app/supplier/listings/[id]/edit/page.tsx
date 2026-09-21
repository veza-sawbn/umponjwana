'use client'

import { useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'

/**
 * /supplier/listings/[id]/edit — redirects to the real property editor.
 *
 * WHAT WAS HERE
 *   772 lines of prototype. A hardcoded MOCK_LISTINGS table — Cathedral Peak
 *   Mountain Lodge, its rooms, its guides, its photos — served for ANY id,
 *   falling back to MOCK_LISTINGS['l1'] when the id was not one of its two
 *   invented ones, which is every real id. handleSave() set a flag that
 *   flashed the word "Saved" for 2.5 seconds and wrote nothing.
 *
 *   It was reachable from normal navigation: the pencil icon on
 *   /supplier/content and the "Edit" button on /supplier/property both link
 *   real ids straight into it. A supplier could open their own lodge, find
 *   someone else's name and nightly rate in the fields, correct them, press
 *   Save, watch it say "Saved", and have changed nothing.
 *
 * WHY A REDIRECT RATHER THAN A REWRITE
 *   The real editor already exists at /supplier/properties/[id]/edit and has
 *   always read and written actual rows (getPropertyById / updateProperty).
 *   Rebuilding a second one here would duplicate a working screen; pointing at
 *   it keeps every existing link working and removes the lie.
 *
 *   An id that is not a real property lands on that editor's own "not found",
 *   which is the honest answer and the one thing the mock never gave.
 */
export default function EditListingRedirect() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()

  useEffect(() => {
    router.replace(`/supplier/properties/${id}/edit`)
  }, [id, router])

  return <div className="p-8 font-sans text-sm text-black/40">Opening the property editor…</div>
}
