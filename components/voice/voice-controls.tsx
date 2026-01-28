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

  return (
    <TooltipProvider>
      <div className="flex items-center justify-center gap-2">
        <Tooltip>
          <TooltipTrigger asChild>
            <Toggle
              pressed={!isMuted}
              onPressedChange={toggleMute}
              className={cn(
                'h-12 w-12 rounded-full',
                isMuted && 'bg-destructive/20 text-destructive hover:bg-destructive/30'
              )}
            >
              {isMuted ? (
                <MicOff className="h-5 w-5" />
              ) : (
                <Mic className="h-5 w-5" />
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
                'h-12 w-12 rounded-full',
                !isVideoEnabled && 'text-muted-foreground'
              )}
            >
              {isVideoEnabled ? (
                <Video className="h-5 w-5" />
              ) : (
                <VideoOff className="h-5 w-5" />
              )}
            </Toggle>
          </TooltipTrigger>
          <TooltipContent>
            {isVideoEnabled ? 'Turn off camera' : 'Turn on camera'}
          </TooltipContent>
        </Tooltip>

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

        <DeviceSettingsDialog
          trigger={
            <Toggle className="h-12 w-12 rounded-full">
              <Settings className="h-5 w-5" />
            </Toggle>
          }
        />

        <div className="w-px h-8 bg-border mx-2" />

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="destructive"
              size="icon"
              className="h-12 w-12 rounded-full"
              onClick={leaveChannel}
            >
              <PhoneOff className="h-5 w-5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Leave channel</TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  )
}
