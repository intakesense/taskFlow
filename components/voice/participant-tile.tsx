'use client'

import {
  useParticipant,
  useVideoTrack,
  useScreenVideoTrack,
  useActiveSpeakerId,
  useActiveParticipant,
  DailyVideo,
} from '@daily-co/daily-react'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Mic, MicOff, Video, VideoOff, Monitor } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ParticipantTileProps {
  sessionId: string
  isLocal?: boolean
  isMobile?: boolean
}

export function ParticipantTile({ sessionId, isLocal, isMobile }: ParticipantTileProps) {
  const participant = useParticipant(sessionId)
  const videoTrack = useVideoTrack(sessionId)
  const screenVideoTrack = useScreenVideoTrack(sessionId)
  const activeSpeakerId = useActiveSpeakerId()
  const activeParticipant = useActiveParticipant()

  if (!participant) return null

  const hasVideo = videoTrack.state === 'playable'
  const hasScreenShare = screenVideoTrack.state === 'playable'
  const isMuted = !participant.audio
  // Only show speaking indicator if:
  // 1. This participant is the active speaker
  // 2. They have audio enabled (not muted)
  // 3. The active participant actually exists and has audio
  const isSpeaking = activeSpeakerId === sessionId && !isMuted && activeParticipant?.audio

  const userName = participant.user_name || 'Anonymous'

  return (
    <div
      className={cn(
        'relative bg-muted rounded-xl overflow-hidden h-full w-full',
        'border-2 transition-all duration-200',
        isSpeaking ? 'border-green-500 shadow-lg shadow-green-500/20' : 'border-transparent'
      )}
    >
      {hasScreenShare ? (
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
          className={cn(
            'w-full h-full',
            // On mobile, use object-contain to show full camera feed without cropping
            // On desktop, use object-cover for a cleaner look
            isMobile ? 'object-contain bg-black' : 'object-cover'
          )}
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-muted">
          <Avatar className={cn('h-20 w-20', isMobile && 'h-16 w-16')}>
            <AvatarFallback className={cn('text-2xl bg-primary text-primary-foreground', isMobile && 'text-xl')}>
              {userName.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
        </div>
      )}

      {isSpeaking && (
        <div className="absolute inset-0 border-4 border-green-500 rounded-xl pointer-events-none" />
      )}

      <div className={cn(
        'absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent',
        isMobile ? 'p-2' : 'p-3'
      )}>
        <div className="flex items-center justify-between">
          <span className={cn(
            'text-white font-medium truncate',
            isMobile ? 'text-xs' : 'text-sm'
          )}>
            {userName}
            {isLocal && ' (You)'}
          </span>

          <div className="flex items-center gap-1.5">
            {hasScreenShare && (
              <Monitor className={cn(isMobile ? 'h-3 w-3' : 'h-4 w-4', 'text-blue-400')} />
            )}
            {hasVideo ? (
              <Video className={cn(isMobile ? 'h-3 w-3' : 'h-4 w-4', 'text-white')} />
            ) : (
              <VideoOff className={cn(isMobile ? 'h-3 w-3' : 'h-4 w-4', 'text-muted-foreground')} />
            )}
            {isMuted ? (
              <MicOff className={cn(isMobile ? 'h-3 w-3' : 'h-4 w-4', 'text-red-400')} />
            ) : (
              <Mic className={cn(isMobile ? 'h-3 w-3' : 'h-4 w-4', isSpeaking ? 'text-green-400' : 'text-white')} />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
