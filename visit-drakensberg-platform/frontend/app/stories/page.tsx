import { redirect } from 'next/navigation'

// The journal lives at /mydrakensberg — this route previously duplicated it
// with article links that had no detail pages. Keep the URL working.
export default function StoriesPage() {
  redirect('/mydrakensberg')
}
