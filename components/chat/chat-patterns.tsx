'use client'

/**
 * Chat Background Patterns
 *
 * Subtle, muted SVG patterns for chat backgrounds.
 * Inspired by WhatsApp's doodle pattern but with a modern, minimal aesthetic.
 */

export type ChatPatternType =
    | 'none'
    | 'doodles'
    | 'dots'
    | 'grid'
    | 'waves'
    | 'geometric'
    | 'confetti'

interface PatternProps {
    className?: string
    opacity?: number
}

// Pattern definitions as inline SVG data URIs for performance
export const PATTERN_DEFINITIONS: Record<ChatPatternType, string | null> = {
    none: null,

    // Doodles - Chat bubbles, hearts, stars, smileys (WhatsApp-inspired)
    doodles: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' stroke='currentColor' stroke-width='0.5' opacity='0.15'%3E%3Cpath d='M10 8c0-2 2-4 5-4s5 2 5 4c0 3-3 4-5 6-2-2-5-3-5-6z'/%3E%3Ccircle cx='45' cy='12' r='3'/%3E%3Cpath d='M30 5l1 3h3l-2 2 1 3-3-2-3 2 1-3-2-2h3z'/%3E%3Cpath d='M8 35c0 0 3-1 4 1s-1 4-1 4'/%3E%3Ccircle cx='50' cy='40' r='2'/%3E%3Cpath d='M25 45c2 0 4 1 4 3s-2 3-4 3-4-1-4-3 2-3 4-3z'/%3E%3Crect x='42' y='25' width='8' height='6' rx='3'/%3E%3Cpath d='M5 55l2-4 2 4'/%3E%3Ccircle cx='35' cy='30' r='1.5'/%3E%3Cpath d='M15 20c1-1 3-1 4 0s1 3 0 4-3 1-4 0-1-3 0-4z'/%3E%3C/g%3E%3C/svg%3E")`,

    // Dots - Simple, clean dot grid
    dots: `url("data:image/svg+xml,%3Csvg width='20' height='20' viewBox='0 0 20 20' xmlns='http://www.w3.org/2000/svg'%3E%3Ccircle cx='2' cy='2' r='1' fill='currentColor' opacity='0.08'/%3E%3C/svg%3E")`,

    // Grid - Subtle line grid
    grid: `url("data:image/svg+xml,%3Csvg width='40' height='40' viewBox='0 0 40 40' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M0 0h40v40H0z' fill='none' stroke='currentColor' stroke-width='0.5' opacity='0.06'/%3E%3C/svg%3E")`,

    // Waves - Flowing wave lines
    waves: `url("data:image/svg+xml,%3Csvg width='100' height='20' viewBox='0 0 100 20' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M0 10c25 0 25-8 50-8s25 8 50 8' fill='none' stroke='currentColor' stroke-width='0.5' opacity='0.08'/%3E%3C/svg%3E")`,

    // Geometric - Triangles and shapes
    geometric: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' stroke='currentColor' stroke-width='0.5' opacity='0.08'%3E%3Cpolygon points='30,5 35,15 25,15'/%3E%3Crect x='5' y='35' width='10' height='10' transform='rotate(45 10 40)'/%3E%3Ccircle cx='50' cy='45' r='5'/%3E%3Cpath d='M40 10h10v10'/%3E%3C/g%3E%3C/svg%3E")`,

    // Confetti - Scattered small shapes
    confetti: `url("data:image/svg+xml,%3Csvg width='50' height='50' viewBox='0 0 50 50' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='currentColor' opacity='0.06'%3E%3Crect x='5' y='8' width='3' height='1' transform='rotate(30 6.5 8.5)'/%3E%3Crect x='25' y='5' width='2' height='1' transform='rotate(-20 26 5.5)'/%3E%3Crect x='40' y='15' width='3' height='1' transform='rotate(45 41.5 15.5)'/%3E%3Crect x='10' y='30' width='2' height='1' transform='rotate(-40 11 30.5)'/%3E%3Crect x='35' y='35' width='3' height='1' transform='rotate(15 36.5 35.5)'/%3E%3Crect x='20' y='42' width='2' height='1' transform='rotate(-25 21 42.5)'/%3E%3Ccircle cx='45' cy='40' r='1'/%3E%3Ccircle cx='8' y='20' r='0.8'/%3E%3C/g%3E%3C/svg%3E")`,
}

// Human-readable labels for the UI
export const PATTERN_LABELS: Record<ChatPatternType, string> = {
    none: 'None',
    doodles: 'Doodles',
    dots: 'Dots',
    grid: 'Grid',
    waves: 'Waves',
    geometric: 'Geometric',
    confetti: 'Confetti',
}

// Pattern descriptions for accessibility and tooltips
export const PATTERN_DESCRIPTIONS: Record<ChatPatternType, string> = {
    none: 'Clean, solid background',
    doodles: 'Playful chat icons and shapes',
    dots: 'Minimal dot pattern',
    grid: 'Subtle line grid',
    waves: 'Flowing wave lines',
    geometric: 'Abstract shapes',
    confetti: 'Scattered confetti pieces',
}

// Preview component for settings
export function PatternPreview({
    pattern,
    isSelected,
    onClick,
}: {
    pattern: ChatPatternType
    isSelected: boolean
    onClick: () => void
}) {
    const patternUrl = PATTERN_DEFINITIONS[pattern]

    return (
        <button
            onClick={onClick}
            className={`
                relative w-16 h-16 rounded-lg border-2 transition-all overflow-hidden
                ${isSelected
                    ? 'border-primary ring-2 ring-primary/20'
                    : 'border-border hover:border-primary/50'
                }
            `}
            title={PATTERN_DESCRIPTIONS[pattern]}
        >
            <div
                className="absolute inset-0 bg-background"
                style={patternUrl ? {
                    backgroundImage: patternUrl,
                    backgroundRepeat: 'repeat',
                } : undefined}
            />
            <span className="absolute bottom-0.5 inset-x-0 text-[9px] text-muted-foreground text-center truncate px-0.5">
                {PATTERN_LABELS[pattern]}
            </span>
        </button>
    )
}

// CSS class generator for applying pattern to elements
export function getChatPatternStyle(pattern: ChatPatternType): React.CSSProperties {
    const patternUrl = PATTERN_DEFINITIONS[pattern]

    if (!patternUrl) {
        return {}
    }

    return {
        backgroundImage: patternUrl,
        backgroundRepeat: 'repeat',
    }
}
