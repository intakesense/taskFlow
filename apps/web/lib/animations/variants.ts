import type { Variants } from 'framer-motion'
import { springs, stagger, durations } from './constants'

// =============================================================================
// Message Bubble Animations
// =============================================================================

// Message bubble entrance - slides in from sender direction
export const messageBubbleVariants: Variants = {
  initial: (isOwn: boolean) => ({
    opacity: 0,
    x: isOwn ? 20 : -20,
    y: 10,
    scale: 0.95,
  }),
  animate: {
    opacity: 1,
    x: 0,
    y: 0,
    scale: 1,
    transition: springs.fast,
  },
  exit: {
    opacity: 0,
    scale: 0.9,
    transition: { duration: durations.fast },
  },
}

// Optimistic message sending animation
export const messageSendVariants: Variants = {
  initial: {
    opacity: 0,
    scale: 0.85,
    x: 30,
  },
  animate: {
    opacity: 1,
    scale: 1,
    x: 0,
    transition: springs.bouncy,
  },
  pending: {
    opacity: 0.7,
    scale: 0.98,
  },
  exit: {
    opacity: 0,
    scale: 0.9,
    transition: { duration: durations.fast },
  },
}

// =============================================================================
// Reaction Animations
// =============================================================================

// Reaction pop animation
export const reactionVariants: Variants = {
  initial: { scale: 0, opacity: 0 },
  animate: {
    scale: 1,
    opacity: 1,
    transition: springs.bouncy,
  },
  exit: {
    scale: 0,
    opacity: 0,
    transition: { duration: durations.instant },
  },
  hover: {
    scale: 1.15,
    transition: springs.micro,
  },
  tap: {
    scale: 0.9,
    transition: springs.micro,
  },
}

// Quick reactions bar
export const reactionBarVariants: Variants = {
  initial: { opacity: 0, scale: 0.9, y: 10 },
  animate: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: {
      ...springs.fast,
      staggerChildren: stagger.fast,
    },
  },
  exit: {
    opacity: 0,
    scale: 0.95,
    transition: { duration: durations.instant },
  },
}

// Individual emoji in reaction bar
export const reactionEmojiVariants: Variants = {
  initial: { scale: 0, rotate: -15 },
  animate: {
    scale: 1,
    rotate: 0,
    transition: springs.bouncy,
  },
  hover: {
    scale: 1.2,
    transition: springs.micro,
  },
  tap: {
    scale: 0.85,
    transition: springs.micro,
  },
}

// Reply reference slide animation
export const replyReferenceVariants: Variants = {
  initial: { height: 0, opacity: 0 },
  animate: {
    height: 'auto',
    opacity: 1,
    transition: springs.default,
  },
  exit: {
    height: 0,
    opacity: 0,
    transition: { duration: durations.fast },
  },
}

// =============================================================================
// List Animations
// =============================================================================

// List container with stagger
export const listContainerVariants: Variants = {
  initial: { opacity: 0 },
  animate: {
    opacity: 1,
    transition: {
      staggerChildren: stagger.fast,
      delayChildren: 0.05,
    },
  },
  exit: {
    opacity: 0,
    transition: {
      staggerChildren: stagger.fast,
      staggerDirection: -1,
    },
  },
}

// List item entrance
export const listItemVariants: Variants = {
  initial: { opacity: 0, x: -20 },
  animate: {
    opacity: 1,
    x: 0,
    transition: springs.fast,
  },
  exit: {
    opacity: 0,
    x: 20,
    transition: { duration: durations.fast },
  },
  hover: {
    x: 4,
    transition: springs.micro,
  },
}

// =============================================================================
// Badge Animations
// =============================================================================

export const badgeVariants: Variants = {
  initial: { scale: 0, opacity: 0 },
  animate: {
    scale: 1,
    opacity: 1,
    transition: springs.bouncy,
  },
  exit: {
    scale: 0,
    opacity: 0,
    transition: { duration: durations.instant },
  },
  pulse: {
    scale: [1, 1.2, 1],
    transition: {
      duration: 0.3,
      times: [0, 0.5, 1],
    },
  },
}

// =============================================================================
// Task Card Animations
// =============================================================================

export const taskCardVariants: Variants = {
  initial: { opacity: 0, y: 20, scale: 0.97 },
  animate: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: springs.default,
  },
  exit: {
    opacity: 0,
    scale: 0.95,
    transition: { duration: durations.normal },
  },
  hover: {
    y: -2,
    scale: 1.01,
    transition: springs.micro,
  },
  tap: {
    scale: 0.99,
    transition: springs.micro,
  },
}

// Status badge transition
export const statusBadgeVariants: Variants = {
  initial: { scale: 0.8, opacity: 0 },
  animate: {
    scale: 1,
    opacity: 1,
    transition: springs.bouncy,
  },
  change: {
    scale: [1, 1.15, 1],
    transition: {
      duration: 0.4,
      times: [0, 0.5, 1],
    },
  },
}

// =============================================================================
// Navigation Animations
// =============================================================================

// Bottom nav indicator
export const navIndicatorVariants: Variants = {
  initial: { scaleX: 0 },
  animate: {
    scaleX: 1,
    transition: springs.fast,
  },
}

// Nav icon active state
export const navIconVariants: Variants = {
  inactive: {
    scale: 1,
    y: 0,
    transition: springs.fast,
  },
  active: {
    scale: 1.1,
    y: -2,
    transition: springs.bouncy,
  },
}

// =============================================================================
// Typing Indicator
// =============================================================================

export const typingBubbleVariants: Variants = {
  initial: { opacity: 0, y: 10, scale: 0.95 },
  animate: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: springs.default,
  },
  exit: {
    opacity: 0,
    y: -5,
    scale: 0.95,
    transition: { duration: durations.fast },
  },
}

// =============================================================================
// Generic Animations
// =============================================================================

export const fadeInVariants: Variants = {
  initial: { opacity: 0 },
  animate: {
    opacity: 1,
    transition: { duration: durations.normal },
  },
  exit: {
    opacity: 0,
    transition: { duration: durations.fast },
  },
}

export const scaleInVariants: Variants = {
  initial: { scale: 0.9, opacity: 0 },
  animate: {
    scale: 1,
    opacity: 1,
    transition: springs.default,
  },
  exit: {
    scale: 0.9,
    opacity: 0,
    transition: { duration: durations.fast },
  },
}

export const slideUpVariants: Variants = {
  initial: { y: 20, opacity: 0 },
  animate: {
    y: 0,
    opacity: 1,
    transition: springs.default,
  },
  exit: {
    y: -10,
    opacity: 0,
    transition: { duration: durations.fast },
  },
}
