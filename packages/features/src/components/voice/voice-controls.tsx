'use client';

import { cn, Toggle, Button, Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@taskflow/ui';
import { Mic, MicOff, Video, VideoOff, Monitor, PhoneOff } from 'lucide-react';
import { useVoiceChannel } from '../../providers/voice-channel-context';

interface VoiceControlsProps {
  className?: string;
}

export function VoiceControls({ className }: VoiceControlsProps) {
  const {
    currentChannel,
    isMuted,
    isVideoOn,
    isScreenSharing,
    toggleMute,
    toggleVideo,
    toggleScreenShare,
    leaveChannel,
  } = useVoiceChannel();

  if (!currentChannel) return null;

  // Screen share not available on macOS Tauri
  const isMacOSTauri =
    typeof window !== 'undefined' &&
    // @ts-expect-error Tauri global
    window.__TAURI__ !== undefined &&
    navigator.userAgent.includes('Mac');

  return (
    <TooltipProvider>
      <div className={cn('flex items-center justify-center gap-2', className)}>
        {/* Mute */}
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
              {isMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
            </Toggle>
          </TooltipTrigger>
          <TooltipContent>{isMuted ? 'Unmute' : 'Mute'}</TooltipContent>
        </Tooltip>

        {/* Video */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Toggle
              pressed={isVideoOn}
              onPressedChange={toggleVideo}
              className={cn(
                'h-12 w-12 rounded-full',
                !isVideoOn && 'text-muted-foreground'
              )}
            >
              {isVideoOn ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
            </Toggle>
          </TooltipTrigger>
          <TooltipContent>{isVideoOn ? 'Turn off camera' : 'Turn on camera'}</TooltipContent>
        </Tooltip>

        {/* Screen share */}
        {!isMacOSTauri && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Toggle
                pressed={isScreenSharing}
                onPressedChange={toggleScreenShare}
                className={cn(
                  'h-12 w-12 rounded-full',
                  isScreenSharing && 'bg-blue-500/20 text-blue-500 hover:bg-blue-500/30'
                )}
              >
                <Monitor className="h-5 w-5" />
              </Toggle>
            </TooltipTrigger>
            <TooltipContent>{isScreenSharing ? 'Stop sharing' : 'Share screen'}</TooltipContent>
          </Tooltip>
        )}

        {/* Divider */}
        <div className="w-px h-8 bg-border mx-2" />

        {/* Leave */}
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
  );
}
