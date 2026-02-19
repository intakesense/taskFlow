'use client'

import { useState } from 'react'
import {
  useParticipant,
  useVideoTrack,
  useScreenVideoTrack,
  useActiveSpeakerId,
  useActiveParticipant,
  DailyVideo,
} from '@daily-co/daily-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { Mic, MicOff, Video, VideoOff, Monitor, Pin, PinOff, Maximize2, Bot } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'

// AI Bot user ID - matches the fixed UUID in the database
const AI_BOT_USER_ID = '00000000-0000-0000-0000-000000000001'

interface ParticipantTileProps {
  sessionId: string
  isLocal?: boolean
  isMobile?: boolean
  isPinned?: boolean
  isFullscreen?: boolean
  onPin?: (sessionId: string) => void
  onUnpin?: () => void
  onFullscreen?: (sessionId: string) => void
}

export function ParticipantTile({
  sessionId,
  isLocal,
  isMobile,
  isPinned,
  isFullscreen,
  onPin,
  onUnpin,
  onFullscreen,
}: ParticipantTileProps) {
  const [showControls, setShowControls] = useState(false)
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
  const avatarUrl = (participant.userData as { avatarUrl?: string } | undefined)?.avatarUrl
  const isBot = participant.user_id === AI_BOT_USER_ID

  // Show camera PiP when screen sharing with camera on
  const showCameraPip = hasScreenShare && hasVideo

  const handlePinClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (isPinned) {
      onUnpin?.()
    } else {
      onPin?.(sessionId)
    }
  }

  const handleFullscreenClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    onFullscreen?.(sessionId)
  }

  return (
    <div
      className={cn(
        'relative bg-muted rounded-xl overflow-hidden h-full w-full group',
        'transition-shadow duration-300 ease-out',
        isSpeaking && !isBot && 'ring-2 ring-green-500 shadow-[0_0_20px_rgba(34,197,94,0.4)]',
        isSpeaking && isBot && 'ring-2 ring-purple-500 shadow-[0_0_20px_rgba(147,51,234,0.4)]',
        isPinned && 'ring-2 ring-primary',
        isBot && !isSpeaking && !isPinned && 'ring-1 ring-purple-500/50'
      )}
      onMouseEnter={() => setShowControls(true)}
      onMouseLeave={() => setShowControls(false)}
      onTouchStart={() => setShowControls(true)}
    >
      {/* Main video content */}
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
            isMobile ? 'object-contain bg-black' : 'object-cover'
          )}
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-muted">
          <Avatar className={cn('h-20 w-20', isMobile && 'h-16 w-16', isBot && 'ring-2 ring-purple-500')}>
            {avatarUrl && <AvatarImage src={avatarUrl} alt={userName} />}
            <AvatarFallback className={cn(
              'text-2xl bg-primary text-primary-foreground',
              isMobile && 'text-xl',
              isBot && 'bg-purple-600'
            )}>
              {isBot ? <Bot className="h-8 w-8" /> : userName.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
        </div>
      )}

      {/* Camera PiP overlay when screen sharing */}
      {showCameraPip && (
        <div
          className={cn(
            'absolute rounded-lg overflow-hidden border-2 border-background/50 shadow-lg',
            'transition-all duration-200',
            isMobile
              ? 'bottom-10 right-2 w-16 h-12'
              : 'bottom-14 right-3 w-28 h-20'
          )}
        >
          <DailyVideo
            sessionId={sessionId}
            type="video"
            mirror={isLocal}
            className="w-full h-full object-cover"
          />
        </div>
      )}

      {/* Pin/Fullscreen controls - show on hover/touch */}
      {(onPin || onFullscreen) && !isFullscreen && (
        <div
          className={cn(
            'absolute top-2 right-2 flex gap-1.5 transition-opacity duration-200 z-10',
            showControls || isMobile ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
          )}
        >
          <TooltipProvider>
            {!isPinned && onFullscreen && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="secondary"
                    size="icon"
                    className={cn(
                      'rounded-full bg-black/50 hover:bg-black/70 text-white border-0',
                      isMobile ? 'h-9 w-9' : 'h-8 w-8'
                    )}
                    onClick={handleFullscreenClick}
                  >
                    <Maximize2 className={cn(isMobile ? 'h-4 w-4' : 'h-4 w-4')} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">Fullscreen</TooltipContent>
              </Tooltip>
            )}
            {onPin && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="secondary"
                    size="icon"
                    className={cn(
                      'rounded-full bg-black/50 hover:bg-black/70 text-white border-0',
                      isMobile ? 'h-9 w-9' : 'h-8 w-8',
                      isPinned && 'bg-primary/70 hover:bg-primary/90'
                    )}
                    onClick={handlePinClick}
                  >
                    {isPinned ? (
                      <PinOff className={cn(isMobile ? 'h-4 w-4' : 'h-4 w-4')} />
                    ) : (
                      <Pin className={cn(isMobile ? 'h-4 w-4' : 'h-4 w-4')} />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  {isPinned ? 'Unpin' : 'Pin'}
                </TooltipContent>
              </Tooltip>
            )}
          </TooltipProvider>
        </div>
      )}

      {/* Status bar */}
      <div className={cn(
        'absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent',
        isMobile ? 'p-2' : 'p-3'
      )}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className={cn(
              'text-white font-medium truncate',
              isMobile ? 'text-xs' : 'text-sm'
            )}>
              {userName}
              {isLocal && ' (You)'}
            </span>
            {isBot && (
              <Badge
                variant="secondary"
                className={cn(
                  'bg-purple-600 text-white border-0 flex-shrink-0',
                  isMobile ? 'text-[10px] px-1 py-0' : 'text-xs px-1.5 py-0'
                )}
              >
                AI
              </Badge>
            )}
          </div>

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
