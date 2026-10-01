// One rule for when a dated listing (event, special, departure/experience)
// drops off the public site: it stays visible for the whole of its last
// calendar day and disappears automatically once that date has passed.
//
// "Today" is taken in South African time, not UTC — the platform's dates
// are Drakensberg wall-clock dates (a departure's `date` is yyyy-mm-dd, an
// event's starts_at/ends_at come from a datetime-local input with no zone).
// Comparing against `new Date().toISOString()` instead kept yesterday's
// listings up until 02:00 SAST and mixed zoned/unzoned strings.

const TIME_ZONE = 'Africa/Johannesburg'

/** Today's date in South Africa as yyyy-mm-dd. */
export function todayISO(now: Date = new Date()): string {
  // en-CA formats as yyyy-mm-dd.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(now)
}

/** True while a listing whose last day is `date` (yyyy-mm-dd or an ISO
 *  date-time — only the date part is used) hasn't passed yet. A missing or
 *  blank date counts as passed, so an undated row is never shown as upcoming. */
export function isOnOrAfterToday(date: string | null | undefined, today: string = todayISO()): boolean {
  const day = (date || '').slice(0, 10)
  return day.length === 10 && day >= today
}

/** An event/special is upcoming until the end of its last day — its end
 *  date when it has one, otherwise its start date. */
export function isEventUpcoming(
  e: { starts_at?: string | null; ends_at?: string | null },
  today: string = todayISO(),
): boolean {
  return isOnOrAfterToday(e.ends_at || e.starts_at, today)
}
