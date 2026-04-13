'use client';

import { useState, useCallback } from 'react';
import {
  useParticipantProperty,
  useVideoTrack,
  useScreenVideoTrack,
  useAudioLevelObserver,
  DailyVideo,
} from '@daily-co/daily-react';
import { cn, Avatar, AvatarFallback } from '@taskflow/ui';
import { Mic, MicOff, Monitor, Pin, PinOff, Maximize2 } from 'lucide-react';

interface ParticipantTileProps {
  sessionId: string;
  isLocal?: boolean;
  isPinned?: boolean;
  isFullscreen?: boolean;
  onPin?: (sessionId: string) => void;
  onUnpin?: () => void;
  onFullscreen?: (sessionId: string) => void;
}

export function ParticipantTile({
  sessionId,
  isLocal,
  isPinned,
  isFullscreen,
  onPin,
  onUnpin,
  onFullscreen,
}: ParticipantTileProps) {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [showControls, setShowControls] = useState(false);

  const userName = useParticipantProperty(sessionId, 'user_name');
  const hasAudio = useParticipantProperty(sessionId, 'audio');
  const videoTrack = useVideoTrack(sessionId);
  const screenVideoTrack = useScreenVideoTrack(sessionId);

  const hasVideo = videoTrack.state === 'playable';
  const hasScreen = screenVideoTrack.state === 'playable';
  const isMuted = !hasAudio;

  // Real-time volume detection — clears automatically when participant goes silent
  useAudioLevelObserver(
    sessionId,
    useCallback((volume: number) => {
      setIsSpeaking(volume > 0.01);
    }, [])
  );

  const handlePinClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isPinned) onUnpin?.();
    else onPin?.(sessionId);
  };

  const handleFullscreenClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onFullscreen?.(sessionId);
  };

  const displayName = (userName as string) || 'Unknown';
  const initial = displayName.charAt(0).toUpperCase();
  const activelySpeaking = isSpeaking && !isMuted;

  return (
    <div
      className={cn(
        'relative rounded-xl overflow-hidden bg-muted h-full w-full',
        'transition-shadow duration-300 ease-out',
        activelySpeaking && 'ring-2 ring-green-500 shadow-[0_0_20px_rgba(34,197,94,0.4)]',
        isPinned && !activelySpeaking && 'ring-2 ring-primary',
      )}
      onMouseEnter={() => setShowControls(true)}
      onMouseLeave={() => setShowControls(false)}
    >
      {/* Video / avatar */}
      {hasScreen ? (
        <DailyVideo
          sessionId={sessionId}
          type="screenVideo"
          className="w-full h-full object-contain bg-black"
        />
      ) : hasVideo ? (
        <DailyVideo
          sessionId={sessionId}
          type="video"
          mirror={isLocal}
          className="w-full h-full object-cover"
        />
      ) : (
        <div className="w-full h-full flex flex-col items-center justify-center gap-2 bg-muted">
          <Avatar className={cn(
            'h-16 w-16 md:h-20 md:w-20 ring-4 transition-all duration-150',
            activelySpeaking ? 'ring-green-500' : 'ring-transparent'
          )}>
            <AvatarFallback className="text-xl md:text-2xl bg-primary text-primary-foreground">
              {initial}
            </AvatarFallback>
          </Avatar>
          <span className="text-sm text-muted-foreground">
            {displayName}{isLocal && ' (You)'}
          </span>
        </div>
      )}

      {/* Camera PiP when screen sharing with camera on */}
      {hasScreen && hasVideo && (
        <div className="absolute bottom-14 right-3 w-28 h-20 rounded-lg overflow-hidden border-2 border-background/50 shadow-lg">
          <DailyVideo
            sessionId={sessionId}
            type="video"
            mirror={isLocal}
            className="w-full h-full object-cover"
          />
        </div>
      )}

      {/* Pin / fullscreen controls */}
      {(onPin || onFullscreen) && !isFullscreen && (
        <div className={cn(
          'absolute top-2 right-2 flex gap-1.5 transition-opacity duration-200 z-10',
          showControls ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
        )}>
          {!isPinned && onFullscreen && (
            <button
              className="h-8 w-8 rounded-full bg-black/50 hover:bg-black/70 text-white flex items-center justify-center"
              onClick={handleFullscreenClick}
              title="Fullscreen"
            >
              <Maximize2 className="h-4 w-4" />
            </button>
          )}
          {onPin && (
            <button
              className={cn(
                'h-8 w-8 rounded-full bg-black/50 hover:bg-black/70 text-white flex items-center justify-center',
                isPinned && 'bg-primary/70 hover:bg-primary/90'
              )}
              onClick={handlePinClick}
              title={isPinned ? 'Unpin' : 'Pin'}
            >
              {isPinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
            </button>
          )}
        </div>
      )}

      {/* Bottom status bar */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-white text-sm font-medium truncate">
              {displayName}{isLocal && ' (You)'}
            </span>
            {hasScreen && (
              <Monitor className="h-4 w-4 text-blue-400 flex-shrink-0" />
            )}
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {isMuted ? (
              <MicOff className="h-4 w-4 text-red-400" />
            ) : (
              <Mic className={cn('h-4 w-4', activelySpeaking ? 'text-green-400' : 'text-white')} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
