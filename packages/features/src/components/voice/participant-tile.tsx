'use client';

import { useEffect, useRef } from 'react';
import type { DailyParticipant } from '@daily-co/daily-js';
import { cn, Avatar, AvatarFallback, AvatarImage } from '@taskflow/ui';
import { Mic, MicOff, Monitor } from 'lucide-react';

interface ParticipantTileProps {
  participant: DailyParticipant;
  isLocal: boolean;
}

export function ParticipantTile({ participant, isLocal }: ParticipantTileProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    if (!participant.tracks) return;

    const videoTrack = participant.tracks.video;
    const audioTrack = participant.tracks.audio;

    if (videoRef.current && videoTrack?.persistentTrack) {
      videoRef.current.srcObject = new MediaStream([videoTrack.persistentTrack]);
    }

    if (audioRef.current && audioTrack?.persistentTrack && !isLocal) {
      audioRef.current.srcObject = new MediaStream([audioTrack.persistentTrack]);
    }
  }, [participant.tracks, isLocal]);

  const hasVideo = participant.video;
  const hasScreen = participant.screen;
  const isMuted = !participant.audio;

  return (
    <div
      className={cn(
        'relative rounded-xl overflow-hidden bg-muted aspect-video',
        'flex items-center justify-center',
        'border border-border'
      )}
    >
      {hasVideo || hasScreen ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={isLocal}
          className="w-full h-full object-cover"
        />
      ) : (
        <div className="flex flex-col items-center gap-2">
          <Avatar className="h-16 w-16 md:h-20 md:w-20">
            <AvatarImage src={undefined} />
            <AvatarFallback className="text-xl md:text-2xl bg-primary text-primary-foreground">
              {participant.user_name?.charAt(0).toUpperCase() || '?'}
            </AvatarFallback>
          </Avatar>
          <span className="text-sm text-muted-foreground">
            {participant.user_name || 'Unknown'}
            {isLocal && ' (You)'}
          </span>
        </div>
      )}

      {/* Audio element for remote participants */}
      {!isLocal && <audio ref={audioRef} autoPlay />}

      {/* Name badge and indicators */}
      <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="bg-black/60 text-white text-xs px-2 py-1 rounded-md backdrop-blur-sm">
            {participant.user_name || 'Unknown'}
            {isLocal && ' (You)'}
          </span>
          {hasScreen && (
            <span className="bg-primary/80 text-primary-foreground text-xs px-2 py-1 rounded-md backdrop-blur-sm flex items-center gap-1">
              <Monitor className="h-3 w-3" />
              Sharing
            </span>
          )}
        </div>

        <div
          className={cn(
            'p-1.5 rounded-full backdrop-blur-sm',
            isMuted ? 'bg-red-500/80' : 'bg-green-500/80'
          )}
        >
          {isMuted ? (
            <MicOff className="h-3 w-3 text-white" />
          ) : (
            <Mic className="h-3 w-3 text-white" />
          )}
        </div>
      </div>
    </div>
  );
}
