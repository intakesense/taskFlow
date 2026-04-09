'use client';

import { cn, Button } from '@taskflow/ui';
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  Monitor,
  MonitorOff,
  PhoneOff,
  Settings,
} from 'lucide-react';
import { useVoiceChannel } from '../../providers/voice-channel-context';

interface VoiceControlsProps {
  onSettingsClick?: () => void;
  showSettings?: boolean;
  className?: string;
}

export function VoiceControls({
  onSettingsClick,
  showSettings = false,
  className,
}: VoiceControlsProps) {
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

  // Check if screen share is available (not available on macOS Tauri)
  const isMacOSTauri =
    typeof window !== 'undefined' &&
    // @ts-expect-error - Tauri global
    window.__TAURI__ !== undefined &&
    navigator.userAgent.includes('Mac');

  return (
    <div className={cn('flex items-center justify-center gap-2 md:gap-4', className)}>
      {/* Mute */}
      <Button
        variant={isMuted ? 'destructive' : 'secondary'}
        size="icon"
        onClick={toggleMute}
        className="h-12 w-12 rounded-full"
        title={isMuted ? 'Unmute' : 'Mute'}
      >
        {isMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
      </Button>

      {/* Video */}
      <Button
        variant={isVideoOn ? 'secondary' : 'outline'}
        size="icon"
        onClick={toggleVideo}
        className="h-12 w-12 rounded-full"
        title={isVideoOn ? 'Turn off camera' : 'Turn on camera'}
      >
        {isVideoOn ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
      </Button>

      {/* Screen Share */}
      {!isMacOSTauri && (
        <Button
          variant={isScreenSharing ? 'secondary' : 'outline'}
          size="icon"
          onClick={toggleScreenShare}
          className="h-12 w-12 rounded-full"
          title={isScreenSharing ? 'Stop sharing' : 'Share screen'}
        >
          {isScreenSharing ? (
            <MonitorOff className="h-5 w-5" />
          ) : (
            <Monitor className="h-5 w-5" />
          )}
        </Button>
      )}

      {/* Settings */}
      {showSettings && onSettingsClick && (
        <Button
          variant="outline"
          size="icon"
          onClick={onSettingsClick}
          className="h-12 w-12 rounded-full"
          title="Settings"
        >
          <Settings className="h-5 w-5" />
        </Button>
      )}

      {/* Leave */}
      <Button
        variant="destructive"
        onClick={leaveChannel}
        className="h-12 px-6 rounded-full"
      >
        <PhoneOff className="h-5 w-5 mr-2" />
        Leave
      </Button>
    </div>
  );
}
