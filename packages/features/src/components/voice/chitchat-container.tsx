'use client';

import { cn, ScrollArea, Skeleton } from '@taskflow/ui';
import { Headphones, Phone, Users, Wifi } from 'lucide-react';
import type { VoiceChannelWithParticipants } from '@taskflow/core';
import { DailyProvider, DailyAudio, useParticipantIds } from '@daily-co/daily-react';
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
    callObject,
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
        {currentChannel && callObject ? (
          <DailyProvider callObject={callObject}>
            <ActiveCallView
              channelName={currentChannel.name}
              connectionState={connectionState}
            />
          </DailyProvider>
        ) : (
          <IdleView
            channels={channels || []}
            isLoading={isLoading}
            onJoinChannel={joinChannel}
            connectionState={connectionState}
          />
        )}
      </div>
    </div>
  );
}

interface ActiveCallViewProps {
  channelName: string;
  connectionState: string;
}

// Must be inside DailyProvider so all Daily hooks work
function ActiveCallView({ channelName, connectionState }: ActiveCallViewProps) {
  const participantIds = useParticipantIds();

  return (
    <>
      {/* Handles all remote audio automatically */}
      <DailyAudio />

      {/* Header */}
      <div className="p-4 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className={cn(
              'h-3 w-3 rounded-full',
              connectionState === 'connected'
                ? 'bg-green-500 animate-pulse'
                : connectionState === 'connecting'
                  ? 'bg-yellow-500 animate-pulse'
                  : 'bg-red-500'
            )}
          />
          <h2 className="font-semibold">{channelName}</h2>
          {connectionState === 'connected' && (
            <span className="text-xs text-muted-foreground flex items-center gap-1 bg-muted px-2 py-0.5 rounded-full">
              <Wifi className="h-3 w-3" />
              Connected
            </span>
          )}
          <span className="text-sm text-muted-foreground flex items-center gap-1">
            <Users className="h-4 w-4" />
            {participantIds.length}
          </span>
        </div>
      </div>

      {/* Participant grid — uses Daily hooks internally */}
      <div className="flex-1 overflow-hidden">
        <ParticipantGrid />
      </div>

      {/* Controls */}
      <div className="p-4 border-t border-border bg-card">
        <VoiceControls />
      </div>
    </>
  );
}

interface IdleViewProps {
  channels: VoiceChannelWithParticipants[];
  isLoading: boolean;
  onJoinChannel: (channel: VoiceChannelWithParticipants) => void;
  connectionState: string;
}

function IdleView({ channels, isLoading, onJoinChannel, connectionState }: IdleViewProps) {
  const defaultChannel = channels?.find((c) => c.is_default);
  const isConnecting = connectionState === 'connecting';

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
              disabled={isConnecting}
              className={cn(
                'px-6 py-3 bg-primary text-primary-foreground rounded-lg',
                'font-medium hover:bg-primary/90 transition-colors',
                'flex items-center gap-2 mx-auto',
                isConnecting && 'opacity-70 cursor-not-allowed'
              )}
            >
              <Headphones className="h-5 w-5" />
              {isConnecting ? 'Connecting...' : `Join ${defaultChannel.name}`}
              {!isConnecting && defaultChannel.participantCount > 0 && (
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
