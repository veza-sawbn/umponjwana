import type { Variants, Transition } from 'framer-motion'

// ─── Duration tokens (ms → seconds for framer-motion) ────────────────────────
export const dur = {
  micro:   0.15,   // 150ms — hover states, colour changes
  fast:    0.2,    // 200ms — small UI feedback (badge, chip)
  base:    0.25,   // 250ms — standard enter/exit
  medium:  0.3,    // 300ms — cards, panels
  slow:    0.4,    // 400ms — complex transitions (max for UI)
  exit:    0.16,   // ~65% of base — exits always faster than enters
  exitMed: 0.2,    // ~65% of medium
}

// ─── Easing tokens ───────────────────────────────────────────────────────────
export const ease = {
  out:    [0.0, 0.0, 0.2, 1]  as const,   // enter — decelerates into rest
  in:     [0.4, 0.0, 1.0, 1]  as const,   // exit  — accelerates out
  inOut:  [0.4, 0.0, 0.2, 1]  as const,   // layout shifts
}

// Spring for panels/modals (natural, interruptible)
export const spring = {
  panel: { type: 'spring', stiffness: 380, damping: 32 } as Transition,
  modal: { type: 'spring', stiffness: 420, damping: 36 } as Transition,
  card:  { type: 'spring', stiffness: 500, damping: 40 } as Transition,
}

// ─── Shared transition presets ───────────────────────────────────────────────
export const t = {
  enter:  { duration: dur.base,   ease: ease.out  } as Transition,
  exit:   { duration: dur.exit,   ease: ease.in   } as Transition,
  medium: { duration: dur.medium, ease: ease.out  } as Transition,
  exitMed:{ duration: dur.exitMed,ease: ease.in   } as Transition,
}

// ─── Reusable variant sets ───────────────────────────────────────────────────

// Fade + slide up (hero text, section headings)
export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 16 },
  show:   { opacity: 1, y: 0, transition: t.enter },
  exit:   { opacity: 0, y: -8,  transition: t.exit  },
}

// Fade only (overlays, crossfades)
export const fade: Variants = {
  hidden: { opacity: 0 },
  show:   { opacity: 1, transition: t.enter },
  exit:   { opacity: 0, transition: t.exit  },
}

// Scale + fade (modals, dropdowns — from trigger)
export const scaleFade: Variants = {
  hidden: { opacity: 0, scale: 0.95 },
  show:   { opacity: 1, scale: 1, transition: spring.modal },
  exit:   { opacity: 0, scale: 0.97, transition: t.exit   },
}

// Slide up from bottom (BookingBar panel, bottom sheets)
export const slideUp: Variants = {
  hidden: { opacity: 0, y: 12 },
  show:   { opacity: 1, y: 0, transition: spring.panel },
  exit:   { opacity: 0, y: 8, transition: t.exitMed   },
}

// Slide up from below (BookingBar bar itself entering the viewport)
export const slideUpBar: Variants = {
  hidden: { y: '100%' },
  show:   { y: 0, transition: spring.panel },
  exit:   { y: '100%', transition: t.exitMed },
}

// Stagger container — wraps a list of items
export function staggerContainer(staggerChildren = 0.04, delayChildren = 0): Variants {
  return {
    hidden: {},
    show:   { transition: { staggerChildren, delayChildren } },
  }
}

// Individual stagger child — use with staggerContainer
export const staggerChild: Variants = {
  hidden: { opacity: 0, y: 12 },
  show:   { opacity: 1, y: 0, transition: t.enter },
}

// Horizontal slide for page navigation (forward = left, back = right)
export function pageSlide(direction: 'forward' | 'back' = 'forward'): Variants {
  const x = direction === 'forward' ? 32 : -32
  return {
    hidden: { opacity: 0, x },
    show:   { opacity: 1, x: 0, transition: t.medium },
    exit:   { opacity: 0, x: -x, transition: t.exitMed },
  }
}

// Reduced motion — return identity variants for users who opt out
export const noMotion: Variants = {
  hidden: {},
  show:   {},
  exit:   {},
}
