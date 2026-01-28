'use client'

import { ParticipantTile } from './participant-tile'
import { cn } from '@/lib/utils'

interface ParticipantGridProps {
  participantIds: string[]
  localSessionId: string | null
}

export function ParticipantGrid({ participantIds, localSessionId }: ParticipantGridProps) {
  const sortedIds = [...participantIds].sort((a, b) => {
    if (a === localSessionId) return -1
    if (b === localSessionId) return 1
    return 0
  })

  const getGridClass = () => {
    const count = sortedIds.length
    if (count === 1) return 'grid-cols-1 max-w-sm mx-auto'
    if (count === 2) return 'grid-cols-2 max-w-2xl mx-auto'
    if (count <= 4) return 'grid-cols-2'
    if (count <= 6) return 'grid-cols-3'
    if (count <= 9) return 'grid-cols-3'
    return 'grid-cols-4'
  }

  if (sortedIds.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        <p>Waiting for participants...</p>
      </div>
    )
  }

  return (
    <div className={cn('grid gap-4', getGridClass())}>
      {sortedIds.map((id) => (
        <ParticipantTile
          key={id}
          sessionId={id}
          isLocal={id === localSessionId}
        />
      ))}
    </div>
  )
}
