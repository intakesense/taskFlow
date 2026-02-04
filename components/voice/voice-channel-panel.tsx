'use client'

import { useEffect } from 'react'
import {
  DailyProvider,
  DailyAudio,
  useParticipantIds,
  useLocalSessionId,
} from '@daily-co/daily-react'
import { useVoiceChannel } from '@/lib/voice/voice-channel-context'
import { useBottomNavVisibility } from '@/components/layout/bottom-nav-context'
import { VoiceControls } from './voice-controls'
import { ParticipantGrid } from './participant-grid'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { PhoneOff, Loader2, Wifi } from 'lucide-react'
import { cn } from '@/lib/utils'

interface VoiceChannelPanelProps {
  className?: string
}

function VoiceChannelContent() {
  const participantIds = useParticipantIds()
  const localSessionId = useLocalSessionId()

  return (
    <>
      <DailyAudio />
      <div className="flex-1 p-4 overflow-auto">
        <ParticipantGrid
          participantIds={participantIds}
          localSessionId={localSessionId}
        />
      </div>

      <div className="border-t p-4 bg-card">
        <VoiceControls />
      </div>
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
      <div className="flex items-center justify-between px-4 py-3 border-b bg-card">
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
          <h2 className="font-semibold">{currentChannel?.name}</h2>
          <Badge variant="secondary" className="gap-1">
            <Wifi className="h-3 w-3" />
            Connected
          </Badge>
        </div>
        <Button
          variant="destructive"
          size="sm"
          onClick={leaveChannel}
          className="gap-2"
        >
          <PhoneOff className="h-4 w-4" />
          Leave
        </Button>
      </div>

      <DailyProvider callObject={callObject}>
        <VoiceChannelContent />
      </DailyProvider>
    </div>
  )
}
