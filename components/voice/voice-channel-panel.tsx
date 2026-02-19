'use client'

import { useEffect } from 'react'
import {
  DailyProvider,
  DailyAudio,
  useParticipantIds,
  useLocalSessionId,
  useActiveSpeakerId,
  useLocalParticipant,
} from '@daily-co/daily-react'
import { useVoiceChannel } from '@/lib/voice/voice-channel-context'
import { useBottomNavVisibility } from '@/components/layout/bottom-nav-context'
import { useIdleDetection } from '@/hooks/use-idle-detection'
import { useBreakpoints } from '@/hooks/use-mobile'
import { useAIBotSession } from '@/hooks/use-ai-bot-session'
import { useAuth } from '@/lib/auth-context'
import { VoiceControls } from './voice-controls'
import { ParticipantGrid } from './participant-grid'
import { IdleWarningDialog } from './idle-warning-dialog'
import { AIVoiceBot } from './ai-voice-bot'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { PhoneOff, Loader2, Wifi } from 'lucide-react'
import { cn } from '@/lib/utils'

interface VoiceChannelPanelProps {
  className?: string
}

interface VoiceChannelContentProps {
  channelId: string
  onActivity: () => void
  showIdleWarning: boolean
  idleSecondsRemaining: number
  onStayConnected: () => void
  onLeave: () => void
}

function VoiceChannelContent({
  channelId,
  onActivity,
  showIdleWarning,
  idleSecondsRemaining,
  onStayConnected,
  onLeave,
}: VoiceChannelContentProps) {
  const participantIds = useParticipantIds()
  const localSessionId = useLocalSessionId()
  const activeSpeakerId = useActiveSpeakerId()
  const localParticipant = useLocalParticipant()
  const { isMobile, isTablet } = useBreakpoints()
  const isSmallScreen = isMobile || isTablet
  const { callObject } = useVoiceChannel()
  const { effectiveUser } = useAuth()

  // AI Bot session
  const {
    isActive: isBotActive,
    isCurrentUserHost,
    clientSecret,
    botName,
    model,
    deactivate: deactivateBot,
  } = useAIBotSession(channelId)

  // Report activity when local user speaks, toggles video, or screen shares
  useEffect(() => {
    if (activeSpeakerId === localSessionId) {
      onActivity()
    }
  }, [activeSpeakerId, localSessionId, onActivity])

  // Report activity when local participant state changes (mute/video/screen)
  const localAudio = localParticipant?.audio
  const localVideo = localParticipant?.video
  const localScreen = localParticipant?.screen
  useEffect(() => {
    if (localAudio !== undefined || localVideo !== undefined || localScreen !== undefined) {
      onActivity()
    }
  }, [localAudio, localVideo, localScreen, onActivity])

  return (
    <>
      <DailyAudio />

      {/* AI Voice Bot - only runs when current user is hosting and has a client secret */}
      {isBotActive && isCurrentUserHost && clientSecret && callObject && effectiveUser && (
        <AIVoiceBot
          dailyCall={callObject}
          clientSecret={clientSecret}
          botName={botName}
          model={model}
          userId={effectiveUser.id}
          userName={effectiveUser.name}
          onDisconnect={deactivateBot}
        />
      )}

      <div className={cn(
        'flex-1 overflow-hidden',
        isSmallScreen ? 'p-1' : 'p-4'
      )}>
        <ParticipantGrid
          participantIds={participantIds}
          localSessionId={localSessionId}
          aiBot={isBotActive ? {
            isInChannel: true,
            botName,
            botAvatarUrl: null,
          } : undefined}
        />
      </div>

      <div className={cn(
        'border-t bg-card',
        isSmallScreen ? 'p-3 pb-safe' : 'p-4'
      )}>
        <VoiceControls />
      </div>

      <IdleWarningDialog
        open={showIdleWarning}
        secondsRemaining={idleSecondsRemaining}
        onStayConnected={onStayConnected}
        onLeave={onLeave}
      />
    </>
  )
}

export function VoiceChannelPanel({ className }: VoiceChannelPanelProps) {
  const {
    isConnected,
    isConnecting,
    currentChannel,
    callObject,
    leaveChannel,
  } = useVoiceChannel()
  const { setVisible } = useBottomNavVisibility()
  const { isMobile, isTablet } = useBreakpoints()
  const isSmallScreen = isMobile || isTablet

  // Idle detection: warn after 10 min, auto-leave after 2 more min
  const {
    showWarning: showIdleWarning,
    secondsRemaining: idleSecondsRemaining,
    stayConnected,
    reportActivity,
  } = useIdleDetection({
    idleTimeout: 10 * 60 * 1000, // 10 minutes
    warningDuration: 2 * 60 * 1000, // 2 minutes to respond
    enabled: isConnected,
    onDisconnect: leaveChannel,
  })

  // Hide bottom nav when voice channel panel is shown
  useEffect(() => {
    setVisible(false)
    return () => setVisible(true)
  }, [setVisible])

  if (!isConnected && !isConnecting) {
    return null
  }

  if (isConnecting) {
    return (
      <div className={cn('flex flex-col items-center justify-center p-8', className)}>
        <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
        <p className="text-muted-foreground">Connecting to {currentChannel?.name}...</p>
      </div>
    )
  }

  if (!callObject) {
    return null
  }

  return (
    <div className={cn('flex flex-col h-full bg-background', className)}>
      <div className={cn(
        'flex items-center justify-between border-b bg-card',
        isSmallScreen ? 'px-3 py-2' : 'px-4 py-3'
      )}>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
          <h2 className={cn('font-semibold', isSmallScreen && 'text-sm')}>
            {currentChannel?.name}
          </h2>
          {!isSmallScreen && (
            <Badge variant="secondary" className="gap-1">
              <Wifi className="h-3 w-3" />
              Connected
            </Badge>
          )}
        </div>
        <Button
          variant="destructive"
          size={isSmallScreen ? 'sm' : 'sm'}
          onClick={leaveChannel}
          className={cn('gap-2', isSmallScreen && 'h-8 px-2')}
        >
          <PhoneOff className="h-4 w-4" />
          {!isSmallScreen && 'Leave'}
        </Button>
      </div>

      <DailyProvider callObject={callObject}>
        <VoiceChannelContent
          channelId={currentChannel?.id || ''}
          onActivity={reportActivity}
          showIdleWarning={showIdleWarning}
          idleSecondsRemaining={idleSecondsRemaining}
          onStayConnected={stayConnected}
          onLeave={leaveChannel}
        />
      </DailyProvider>
    </div>
  )
}
