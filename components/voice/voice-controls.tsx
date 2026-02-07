'use client'

import { useVoiceChannel } from '@/lib/voice/voice-channel-context'
import { Button } from '@/components/ui/button'
import { Toggle } from '@/components/ui/toggle'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  Monitor,
  MonitorOff,
  PhoneOff,
  Settings,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { DeviceSettingsDialog } from './device-settings-dialog'
import { useBreakpoints } from '@/hooks/use-mobile'

export function VoiceControls() {
  const {
    isMuted,
    isVideoEnabled,
    isScreenSharing,
    toggleMute,
    toggleVideo,
    toggleScreenShare,
    leaveChannel,
  } = useVoiceChannel()

  const { isMobile, isTablet } = useBreakpoints()
  const isSmallScreen = isMobile || isTablet

  // Screen sharing is not supported on mobile browsers
  const showScreenShare = !isSmallScreen

  return (
    <TooltipProvider>
      <div className={cn(
        'flex items-center justify-center',
        isSmallScreen ? 'gap-3' : 'gap-2'
      )}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Toggle
              pressed={!isMuted}
              onPressedChange={toggleMute}
              className={cn(
                'rounded-full',
                isSmallScreen ? 'h-14 w-14' : 'h-12 w-12',
                isMuted && 'bg-destructive/20 text-destructive hover:bg-destructive/30'
              )}
            >
              {isMuted ? (
                <MicOff className={cn(isSmallScreen ? 'h-6 w-6' : 'h-5 w-5')} />
              ) : (
                <Mic className={cn(isSmallScreen ? 'h-6 w-6' : 'h-5 w-5')} />
              )}
            </Toggle>
          </TooltipTrigger>
          <TooltipContent>
            {isMuted ? 'Unmute' : 'Mute'}
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Toggle
              pressed={isVideoEnabled}
              onPressedChange={toggleVideo}
              className={cn(
                'rounded-full',
                isSmallScreen ? 'h-14 w-14' : 'h-12 w-12',
                !isVideoEnabled && 'text-muted-foreground'
              )}
            >
              {isVideoEnabled ? (
                <Video className={cn(isSmallScreen ? 'h-6 w-6' : 'h-5 w-5')} />
              ) : (
                <VideoOff className={cn(isSmallScreen ? 'h-6 w-6' : 'h-5 w-5')} />
              )}
            </Toggle>
          </TooltipTrigger>
          <TooltipContent>
            {isVideoEnabled ? 'Turn off camera' : 'Turn on camera'}
          </TooltipContent>
        </Tooltip>

        {showScreenShare && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Toggle
                pressed={isScreenSharing}
                onPressedChange={toggleScreenShare}
                className={cn(
                  'h-12 w-12 rounded-full',
                  isScreenSharing && 'bg-blue-500/20 text-blue-500'
                )}
              >
                {isScreenSharing ? (
                  <Monitor className="h-5 w-5" />
                ) : (
                  <MonitorOff className="h-5 w-5" />
                )}
              </Toggle>
            </TooltipTrigger>
            <TooltipContent>
              {isScreenSharing ? 'Stop sharing' : 'Share screen'}
            </TooltipContent>
          </Tooltip>
        )}

        <DeviceSettingsDialog
          trigger={
            <Toggle className={cn(
              'rounded-full',
              isSmallScreen ? 'h-14 w-14' : 'h-12 w-12'
            )}>
              <Settings className={cn(isSmallScreen ? 'h-6 w-6' : 'h-5 w-5')} />
            </Toggle>
          }
        />

        <div className={cn(
          'bg-border',
          isSmallScreen ? 'w-px h-10 mx-1' : 'w-px h-8 mx-2'
        )} />

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="destructive"
              size="icon"
              className={cn(
                'rounded-full',
                isSmallScreen ? 'h-14 w-14' : 'h-12 w-12'
              )}
              onClick={leaveChannel}
            >
              <PhoneOff className={cn(isSmallScreen ? 'h-6 w-6' : 'h-5 w-5')} />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Leave channel</TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  )
}
