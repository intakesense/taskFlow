'use client';

import type { DailyParticipant } from '@daily-co/daily-js';
import { ParticipantTile } from './participant-tile';

interface ParticipantGridProps {
  participants: DailyParticipant[];
  localParticipant: DailyParticipant | null;
}

export function ParticipantGrid({
  participants,
  localParticipant,
}: ParticipantGridProps) {
  const allParticipants = localParticipant
    ? [localParticipant, ...participants]
    : participants;

  // Dynamic grid layout based on participant count
  const getGridClass = () => {
    const count = allParticipants.length;
    if (count <= 1) return 'grid-cols-1 max-w-xl mx-auto';
    if (count === 2) return 'grid-cols-2 max-w-3xl mx-auto';
    if (count <= 4) return 'grid-cols-2';
    if (count <= 6) return 'grid-cols-3';
    return 'grid-cols-3 md:grid-cols-4';
  };

  if (allParticipants.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        <p>No one else is here yet</p>
      </div>
    );
  }

  return (
    <div className={`grid ${getGridClass()} gap-3 md:gap-4 h-full content-center p-4`}>
      {allParticipants.map((participant) => (
        <ParticipantTile
          key={participant.session_id}
          participant={participant}
          isLocal={participant.local}
        />
      ))}
    </div>
  );
}
