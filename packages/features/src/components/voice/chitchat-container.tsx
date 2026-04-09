'use client';

import { cn, ScrollArea, Skeleton } from '@taskflow/ui';
import { Headphones, Phone, Users } from 'lucide-react';
import type { VoiceChannelWithParticipants } from '@taskflow/core';
import {
  useVoiceChannels,
  useVoiceChannelsRealtime,
} from '../../hooks/use-voice-channels';
import { useVoiceChannel } from '../../providers/voice-channel-context';
import { VoiceChannelPanel } from './voice-channel-panel';
import { VoiceControls } from './voice-controls';
import { ParticipantGrid } from './participant-grid';

export function ChitChatContainer() {
  useVoiceChannelsRealtime();
  const { data: channels, isLoading } = useVoiceChannels();
  const {
    currentChannel,
    connectionState,
    participants,
    localParticipant,
    joinChannel,
  } = useVoiceChannel();

  return (
    <div className="flex h-full">
      {/* Channel list sidebar */}
      <div className="w-64 border-r border-border bg-card hidden md:flex flex-col">
        <div className="p-4 border-b border-border">
          <h2 className="font-semibold flex items-center gap-2">
            <Headphones className="h-5 w-5" />
            Voice Channels
          </h2>
        </div>
        <ScrollArea className="flex-1">
          <div className="p-2 space-y-1">
            {isLoading ? (
              <>
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </>
            ) : (
              channels?.map((channel) => (
                <VoiceChannelPanel
                  key={channel.id}
                  channel={channel}
                  isActive={currentChannel?.id === channel.id}
                  onJoin={() => joinChannel(channel)}
                />
              ))
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Main content area */}
      <div className="flex-1 flex flex-col bg-background">
        {currentChannel ? (
          <ActiveCallView
            participants={participants}
            localParticipant={localParticipant}
            channelName={currentChannel.name}
            connectionState={connectionState}
          />
        ) : (
          <IdleView
            channels={channels || []}
            isLoading={isLoading}
            onJoinChannel={joinChannel}
          />
        )}
      </div>
    </div>
  );
}

interface ActiveCallViewProps {
  participants: ReturnType<typeof useVoiceChannel>['participants'];
  localParticipant: ReturnType<typeof useVoiceChannel>['localParticipant'];
  channelName: string;
  connectionState: string;
}

function ActiveCallView({
  participants,
  localParticipant,
  channelName,
  connectionState,
}: ActiveCallViewProps) {
  return (
    <>
      {/* Header */}
      <div className="p-4 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className={cn(
              'h-3 w-3 rounded-full',
              connectionState === 'connected'
                ? 'bg-green-500'
                : connectionState === 'connecting'
                  ? 'bg-yellow-500 animate-pulse'
                  : 'bg-red-500'
            )}
          />
          <h2 className="font-semibold">{channelName}</h2>
          <span className="text-sm text-muted-foreground flex items-center gap-1">
            <Users className="h-4 w-4" />
            {(localParticipant ? 1 : 0) + participants.length}
          </span>
        </div>
      </div>

      {/* Participant grid */}
      <div className="flex-1 overflow-hidden">
        <ParticipantGrid
          participants={participants}
          localParticipant={localParticipant}
        />
      </div>

      {/* Controls bar */}
      <div className="p-4 border-t border-border bg-card">
        <VoiceControls />
      </div>
    </>
  );
}

interface IdleViewProps {
  channels: VoiceChannelWithParticipants[] | undefined;
  isLoading: boolean;
  onJoinChannel: (channel: VoiceChannelWithParticipants) => void;
}

function IdleView({ channels, isLoading, onJoinChannel }: IdleViewProps) {
  // Find default channel for quick join
  const defaultChannel = channels?.find((c) => c.is_default);

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8">
      <div className="text-center max-w-md">
        <div className="mx-auto w-20 h-20 bg-muted rounded-full flex items-center justify-center mb-6">
          <Phone className="h-10 w-10 text-muted-foreground" />
        </div>
        <h2 className="text-2xl font-bold mb-2">ChitChat</h2>
        <p className="text-muted-foreground mb-8">
          Join a voice channel to chat with your team in real-time
        </p>

        {/* Mobile channel list */}
        <div className="md:hidden space-y-2 w-full max-w-xs mx-auto">
          {isLoading ? (
            <>
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </>
          ) : (
            channels?.map((channel) => (
              <VoiceChannelPanel
                key={channel.id}
                channel={channel}
                isActive={false}
                onJoin={() => onJoinChannel(channel)}
              />
            ))
          )}
        </div>

        {/* Desktop quick join */}
        <div className="hidden md:block">
          {defaultChannel && (
            <button
              onClick={() => onJoinChannel(defaultChannel)}
              className={cn(
                'px-6 py-3 bg-primary text-primary-foreground rounded-lg',
                'font-medium hover:bg-primary/90 transition-colors',
                'flex items-center gap-2 mx-auto'
              )}
            >
              <Headphones className="h-5 w-5" />
              Join {defaultChannel.name}
              {defaultChannel.participantCount > 0 && (
                <span className="bg-primary-foreground/20 px-2 py-0.5 rounded text-sm">
                  {defaultChannel.participantCount} online
                </span>
              )}
            </button>
          )}
          <p className="text-sm text-muted-foreground mt-4">
            Or select a channel from the sidebar
          </p>
        </div>
      </div>
    </div>
  );
}
