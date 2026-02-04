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
}

export function ParticipantTile({ sessionId, isLocal }: ParticipantTileProps) {
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
        'relative aspect-video bg-muted rounded-xl overflow-hidden',
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
          className="w-full h-full object-cover"
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-muted">
          <Avatar className="h-20 w-20">
            <AvatarFallback className="text-2xl bg-primary text-primary-foreground">
              {userName.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
        </div>
      )}


      {isSpeaking && (
        <div className="absolute inset-0 border-4 border-green-500 rounded-xl pointer-events-none" />
      )}

      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-3">
        <div className="flex items-center justify-between">
          <span className="text-white text-sm font-medium truncate">
            {userName}
            {isLocal && ' (You)'}
          </span>

          <div className="flex items-center gap-2">
            {hasScreenShare && (
              <Monitor className="h-4 w-4 text-blue-400" />
            )}
            {hasVideo ? (
              <Video className="h-4 w-4 text-white" />
            ) : (
              <VideoOff className="h-4 w-4 text-muted-foreground" />
            )}
            {isMuted ? (
              <MicOff className="h-4 w-4 text-red-400" />
            ) : (
              <Mic className={cn('h-4 w-4', isSpeaking ? 'text-green-400' : 'text-white')} />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
