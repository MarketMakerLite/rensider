import type { Variants, Transition } from 'motion/react'

/**
 * Shared animation configuration for consistent, subtle animations
 * across the application. Professional and elegant - not overdone.
 */

// Base easing curves
export const easing = {
  // Smooth, natural feeling
  smooth: [0.4, 0, 0.2, 1],
  // Quick start, slow finish
  decelerate: [0, 0, 0.2, 1],
  // Slow start, quick finish
  accelerate: [0.4, 0, 1, 1],
  // Subtle spring-like
  spring: [0.34, 1.56, 0.64, 1],
} as const

// Standard durations (in seconds)
export const duration = {
  instant: 0.1,
  fast: 0.15,
  normal: 0.25,
  slow: 0.4,
  slower: 0.6,
} as const

// Standard transitions
export const transition: Record<string, Transition> = {
  default: {
    duration: duration.normal,
    ease: easing.smooth,
  },
  fast: {
    duration: duration.fast,
    ease: easing.smooth,
  },
  slow: {
    duration: duration.slow,
    ease: easing.decelerate,
  },
  spring: {
    type: 'spring',
    stiffness: 400,
    damping: 30,
  },
  springGentle: {
    type: 'spring',
    stiffness: 300,
    damping: 25,
  },
}

/**
 * Fade in animation - subtle opacity transition
 */
export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: transition.default,
  },
  exit: {
    opacity: 0,
    transition: transition.fast,
  },
}

/**
 * Fade up - element fades in while moving up slightly
 */
export const fadeUp: Variants = {
  hidden: {
    opacity: 0,
    y: 8,
  },
  visible: {
    opacity: 1,
    y: 0,
    transition: transition.default,
  },
  exit: {
    opacity: 0,
    y: -4,
    transition: transition.fast,
  },
}

/**
 * Scale fade - subtle scale with fade
 */
export const scaleFade: Variants = {
  hidden: {
    opacity: 0,
    scale: 0.96,
  },
  visible: {
    opacity: 1,
    scale: 1,
    transition: transition.default,
  },
  exit: {
    opacity: 0,
    scale: 0.98,
    transition: transition.fast,
  },
}

/**
 * Stagger container - use with staggered children
 */
export const staggerContainer: Variants = {
  hidden: { opacity: 1 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.04,
      delayChildren: 0.02,
    },
  },
}

/**
 * Stagger container for slower reveals (grids, cards)
 */
export const staggerContainerSlow: Variants = {
  hidden: { opacity: 1 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.06,
      delayChildren: 0.05,
    },
  },
}

/**
 * Stagger item - child of stagger container
 */
export const staggerItem: Variants = {
  hidden: {
    opacity: 0,
    y: 6,
  },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: duration.normal,
      ease: easing.smooth,
    },
  },
}

/**
 * Card hover animation values (use with whileHover)
 */
export const cardHover = {
  y: -2,
  transition: transition.fast,
}

/**
 * Button tap animation (use with whileTap)
 */
export const buttonTap = {
  scale: 0.98,
  transition: { duration: 0.1 },
}

/**
 * Dropdown/menu animation
 */
export const dropdown: Variants = {
  hidden: {
    opacity: 0,
    y: -4,
    scale: 0.98,
  },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      duration: duration.fast,
      ease: easing.decelerate,
    },
  },
  exit: {
    opacity: 0,
    y: -4,
    scale: 0.98,
    transition: {
      duration: duration.instant,
      ease: easing.accelerate,
    },
  },
}

/**
 * Bottom sheet animation - slides up from bottom
 */
export const bottomSheet: Variants = {
  hidden: {
    y: '100%',
  },
  visible: {
    y: 0,
    transition: {
      type: 'spring',
      damping: 25,
      stiffness: 300,
    },
  },
  exit: {
    y: '100%',
    transition: {
      duration: duration.fast,
      ease: easing.accelerate,
    },
  },
}

/**
 * Right drawer animation - slides in from right edge
 */
export const rightDrawer: Variants = {
  hidden: {
    x: '100%',
  },
  visible: {
    x: 0,
    transition: {
      type: 'spring',
      damping: 25,
      stiffness: 300,
    },
  },
  exit: {
    x: '100%',
    transition: {
      duration: duration.fast,
      ease: easing.accelerate,
    },
  },
}

