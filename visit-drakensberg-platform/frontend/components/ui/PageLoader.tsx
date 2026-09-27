import clsx from 'clsx'

/**
 * The one loading state for a page or a page section: the site's mountain mark
 * with a line saying what is loading. Replaces the bare spinners and grey
 * "Loading…" lines that used to differ page to page, and announces itself to
 * screen readers (role="status"), which a spinning border never did.
 */
export default function PageLoader({
  label = 'Loading',
  fullScreen = false,
  className,
}: {
  /** What is loading, e.g. "Loading your trip". Shown and announced. */
  label?: string
  /** Fill the viewport (for a whole route) rather than a section. */
  fullScreen?: boolean
  className?: string
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={clsx(
        'flex flex-col items-center justify-center gap-4 px-6 text-center',
        fullScreen ? 'min-h-screen bg-mist pt-24' : 'py-20',
        className,
      )}
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 64 64"
        className="h-10 w-10 animate-pulse motion-reduce:animate-none"
      >
        <rect width="64" height="64" rx="12" fill="#2d6a4f" />
        <path d="M6 50 L22 24 L30 36 L41 16 L58 50 Z" fill="#C9A96E" />
        <path d="M41 16 L35.5 26 L39 24.5 L41.5 27 L44.5 24 L47 25.5 Z" fill="#F7F5F2" />
      </svg>
      <p className="font-sans text-sm text-forest/60">{label}…</p>
    </div>
  )
}
