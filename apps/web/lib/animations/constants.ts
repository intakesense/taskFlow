import type { Transition } from 'framer-motion'

// =============================================================================
// Spring Configurations - WhatsApp-style snappy feel
// =============================================================================

export const springs = {
  // Ultra fast - for micro-interactions (buttons, toggles)
  micro: { type: 'spring', stiffness: 700, damping: 30 } as Transition,

  // Fast - for UI feedback (selections, hovers)
  fast: { type: 'spring', stiffness: 500, damping: 30 } as Transition,

  // Default - for most animations (entrances, exits)
  default: { type: 'spring', stiffness: 400, damping: 30 } as Transition,

  // Gentle - for larger movements (page transitions)
  gentle: { type: 'spring', stiffness: 300, damping: 25 } as Transition,

  // Bouncy - for celebratory animations (reactions, success)
  bouncy: { type: 'spring', stiffness: 600, damping: 15 } as Transition,

  // Stiff - for positional changes (drag, reorder)
  stiff: { type: 'spring', stiffness: 800, damping: 35 } as Transition,
} as const

// =============================================================================
// Duration Presets (for non-spring animations)
// =============================================================================

export const durations = {
  instant: 0.1,
  fast: 0.15,
  normal: 0.2,
  slow: 0.3,
  verySlow: 0.5,
} as const

// =============================================================================
// Stagger Configurations
// =============================================================================

export const stagger = {
  fast: 0.03, // 30ms between items
  normal: 0.05, // 50ms between items
  slow: 0.08, // 80ms between items
} as const

// =============================================================================
// Easing Functions (for non-spring animations)
// =============================================================================

export const easings = {
  easeOut: [0.16, 1, 0.3, 1] as const,
  easeInOut: [0.76, 0, 0.24, 1] as const,
  anticipate: [0.68, -0.6, 0.32, 1.6] as const,
}
