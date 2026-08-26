import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'

// The public activity page (app/activities/[id]/page.tsx) is ISR-cached for
// up to 5 minutes so a supplier's price/timeslot edit doesn't reach visitors
// until the cache naturally expires. Called (best-effort, fire-and-forget)
// from lib/activities.ts right after a supplier creates/edits an activity,
// so the change is visible on the very next visitor request instead of
// waiting out the cache window.
export async function POST(req: NextRequest) {
  try {
    const { id, slug } = await req.json()
    if (typeof id === 'string' && id) revalidatePath(`/activities/${id}`)
    if (typeof slug === 'string' && slug && slug !== id) revalidatePath(`/activities/${slug}`)
    revalidatePath('/activities')
    return NextResponse.json({ revalidated: true })
  } catch {
    return NextResponse.json({ revalidated: false }, { status: 400 })
  }
}
