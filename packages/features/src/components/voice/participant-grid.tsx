'use client';

import { useState, useCallback } from 'react';
import { useParticipantIds, useLocalSessionId } from '@daily-co/daily-react';
import { cn } from '@taskflow/ui';
import { ParticipantTile } from './participant-tile';
import { Minimize2, X } from 'lucide-react';

export function ParticipantGrid() {
  const participantIds = useParticipantIds();
  const localSessionId = useLocalSessionId();
  const [pinnedSessionId, setPinnedSessionId] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const handlePin = useCallback((sessionId: string) => {
    setPinnedSessionId(sessionId);
  }, []);

  const handleUnpin = useCallback(() => {
    setPinnedSessionId(null);
    setIsFullscreen(false);
  }, []);

  const handleFullscreen = useCallback((sessionId: string) => {
    setPinnedSessionId(sessionId);
    setIsFullscreen(true);
  }, []);

  // Reset pin if that participant leaves
  if (pinnedSessionId && !participantIds.includes(pinnedSessionId)) {
    setPinnedSessionId(null);
    setIsFullscreen(false);
  }

  // Local first, then others
  const sortedIds = [...participantIds].sort((a, b) => {
    if (a === localSessionId) return -1;
    if (b === localSessionId) return 1;
    return 0;
  });

  const count = sortedIds.length;

  if (count === 0) {
    return null;
  }

  // Fullscreen: single participant fills the entire area
  if (isFullscreen && pinnedSessionId) {
    return (
      <div className="relative h-full w-full p-2">
        <div className="absolute top-4 right-4 z-10 flex gap-2">
          <button
            className="h-10 w-10 rounded-full bg-black/50 hover:bg-black/70 text-white flex items-center justify-center"
            onClick={() => setIsFullscreen(false)}
          >
            <Minimize2 className="h-5 w-5" />
          </button>
          <button
            className="h-10 w-10 rounded-full bg-black/50 hover:bg-black/70 text-white flex items-center justify-center"
            onClick={handleUnpin}
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <ParticipantTile
          sessionId={pinnedSessionId}
          isLocal={pinnedSessionId === localSessionId}
          isPinned
          isFullscreen
          onPin={handlePin}
          onUnpin={handleUnpin}
          onFullscreen={handleFullscreen}
        />
      </div>
    );
  }

  // Pinned spotlight: large main + side strip
  if (pinnedSessionId) {
    const otherIds = sortedIds.filter((id) => id !== pinnedSessionId);
    return (
      <div className="flex h-full w-full gap-2 p-2">
        {/* Main */}
        <div className="relative flex-1">
          <button
            className="absolute top-2 right-2 z-10 h-8 w-8 rounded-full bg-black/50 hover:bg-black/70 text-white flex items-center justify-center"
            onClick={handleUnpin}
          >
            <X className="h-4 w-4" />
          </button>
          <ParticipantTile
            sessionId={pinnedSessionId}
            isLocal={pinnedSessionId === localSessionId}
            isPinned
            onPin={handlePin}
            onUnpin={handleUnpin}
            onFullscreen={handleFullscreen}
          />
        </div>
        {/* Strip */}
        {otherIds.length > 0 && (
          <div className="flex flex-col gap-2 w-48 flex-shrink-0 overflow-auto">
            {otherIds.map((id) => (
              <div key={id} className="w-full h-36 flex-shrink-0">
                <ParticipantTile
                  sessionId={id}
                  isLocal={id === localSessionId}
                  onPin={handlePin}
                  onUnpin={handleUnpin}
                  onFullscreen={handleFullscreen}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Normal grid
  const getGridClass = () => {
    if (count === 1) return 'grid-cols-1 grid-rows-1';
    if (count === 2) return 'grid-cols-2 grid-rows-1';
    if (count === 3) return 'grid-cols-3 grid-rows-1';
    if (count === 4) return 'grid-cols-2 grid-rows-2';
    if (count <= 6) return 'grid-cols-3 grid-rows-2';
    if (count <= 9) return 'grid-cols-3 grid-rows-3';
    return 'grid-cols-4';
  };

  return (
    <div className={cn('grid h-full w-full gap-2 p-2', getGridClass())}>
      {sortedIds.map((id) => (
        <ParticipantTile
          key={id}
          sessionId={id}
          isLocal={id === localSessionId}
          onPin={handlePin}
          onUnpin={handleUnpin}
          onFullscreen={handleFullscreen}
        />
      ))}
    </div>
  );
}
