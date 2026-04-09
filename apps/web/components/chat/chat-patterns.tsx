'use client'

/**
 * Chat Background Patterns
 *
 * Pattern types and labels for chat backgrounds.
 * Actual rendering is done via CSS in globals.css:
 * - .chat-pattern-bg[data-pattern="..."] for chat message areas
 * - .pattern-preview[data-pattern="..."] for settings thumbnails
 */

// Re-export type from theme for convenience
export type { ChatPatternType } from '@/lib/theme/types'

// Human-readable labels for the UI
export const PATTERN_LABELS = {
    none: 'None',
    dots: 'Dots',
    grid: 'Grid',
    waves: 'Waves',
    confetti: 'Confetti',
} as const

// Pattern descriptions for accessibility
export const PATTERN_DESCRIPTIONS = {
    none: 'Clean, solid background',
    dots: 'Minimal dot matrix',
    grid: 'Subtle crosshatch lines',
    waves: 'Flowing curved lines',
    confetti: 'Scattered confetti pieces',
} as const
