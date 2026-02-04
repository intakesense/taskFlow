'use client'

import { ParticipantTile } from './participant-tile'
import { cn } from '@/lib/utils'
import { useBreakpoints } from '@/hooks/use-mobile'

interface ParticipantGridProps {
  participantIds: string[]
  localSessionId: string | null
}

export function ParticipantGrid({ participantIds, localSessionId }: ParticipantGridProps) {
  const { isMobile, isTablet } = useBreakpoints()
  const isSmallScreen = isMobile || isTablet

  const sortedIds = [...participantIds].sort((a, b) => {
    if (a === localSessionId) return -1
    if (b === localSessionId) return 1
    return 0
  })

  const count = sortedIds.length

  if (count === 0) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        <p>Waiting for participants...</p>
      </div>
    )
  }

  // Calculate optimal grid layout based on participant count and screen size
  const getGridLayout = () => {
    if (isSmallScreen) {
      // Mobile/Tablet: Portrait-oriented layouts
      if (count === 1) return { cols: 1, rows: 1, className: 'grid-cols-1 grid-rows-1' }
      if (count === 2) return { cols: 1, rows: 2, className: 'grid-cols-1 grid-rows-2' }
      if (count <= 4) return { cols: 2, rows: 2, className: 'grid-cols-2 grid-rows-2' }
      if (count <= 6) return { cols: 2, rows: 3, className: 'grid-cols-2 grid-rows-3' }
      return { cols: 2, rows: Math.ceil(count / 2), className: 'grid-cols-2' }
    }

    // Desktop: Landscape-oriented layouts
    if (count === 1) return { cols: 1, rows: 1, className: 'grid-cols-1 grid-rows-1' }
    if (count === 2) return { cols: 2, rows: 1, className: 'grid-cols-2 grid-rows-1' }
    if (count === 3) return { cols: 3, rows: 1, className: 'grid-cols-3 grid-rows-1' }
    if (count === 4) return { cols: 2, rows: 2, className: 'grid-cols-2 grid-rows-2' }
    if (count <= 6) return { cols: 3, rows: 2, className: 'grid-cols-3 grid-rows-2' }
    if (count <= 9) return { cols: 3, rows: 3, className: 'grid-cols-3 grid-rows-3' }
    if (count <= 12) return { cols: 4, rows: 3, className: 'grid-cols-4 grid-rows-3' }
    return { cols: 4, rows: Math.ceil(count / 4), className: 'grid-cols-4' }
  }

  const layout = getGridLayout()

  return (
    <div
      className={cn(
        'grid h-full w-full gap-2 p-2',
        layout.className
      )}
    >
      {sortedIds.map((id) => (
        <ParticipantTile
          key={id}
          sessionId={id}
          isLocal={id === localSessionId}
          isMobile={isSmallScreen}
        />
      ))}
    </div>
  )
}
