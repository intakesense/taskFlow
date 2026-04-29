'use client';

import { useState, useEffect } from 'react';
import { cn, ScrollArea, Skeleton, Button, Input, Switch, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@taskflow/ui';
import { Headphones, Users, Wifi, Plus, Trash2, Loader2, Lock, MoreHorizontal } from 'lucide-react';
import type { VoiceChannelWithParticipants } from '@taskflow/core';
import { DailyProvider, DailyAudio, useParticipantIds } from '@daily-co/daily-react';
import {
  useVoiceChannels,
  useVoiceChannelsRealtime,
  useCreateVoiceChannel,
  useDeleteVoiceChannel,
} from '../../hooks/use-voice-channels';
import { ChannelMembersDialog } from './channel-members-dialog';
import { useVoiceChannel } from '../../providers/voice-channel-context';
import { useAuth } from '../../providers/auth-context';
import { useBottomNavVisibility } from '../layout/bottom-nav-context';
import { VoiceChannelPanel } from './voice-channel-panel';
import { VoiceControls } from './voice-controls';
import { ParticipantGrid } from './participant-grid';
import { ErrorBoundary } from '../error-boundary';

export function ChitChatContainer() {
  useVoiceChannelsRealtime();
  const { data: channels, isLoading } = useVoiceChannels();
  const { currentChannel, connectionState, callObject, joinChannel } = useVoiceChannel();
  const { profile } = useAuth();
  const isAdmin = profile?.is_admin ?? false;
  const { setVisible } = useBottomNavVisibility();

  const isInCall = connectionState === 'connected' || connectionState === 'connecting';

  useEffect(() => {
    if (isInCall) setVisible(false);
    return () => setVisible(true);
  }, [isInCall, setVisible]);

  const createChannel = useCreateVoiceChannel();
  const deleteChannel = useDeleteVoiceChannel();

  const [showNewChannel, setShowNewChannel] = useState(false);
  const [newChannelName, setNewChannelName] = useState('');
  const [newChannelPrivate, setNewChannelPrivate] = useState(false);
  const [managingChannel, setManagingChannel] = useState<VoiceChannelWithParticipants | null>(null);

  const handleCreateChannel = async () => {
    if (!newChannelName.trim() || !profile) return;
    await createChannel.mutateAsync({
      name: newChannelName,
      description: null,
      createdBy: profile.id,
      isPrivate: newChannelPrivate,
    });
    setNewChannelName('');
    setNewChannelPrivate(false);
    setShowNewChannel(false);
  };

  const handleDeleteChannel = (e: React.MouseEvent, channelId: string) => {
    e.stopPropagation();
    deleteChannel.mutate(channelId);
  };

  return (
    <div className="flex h-full">
      {/* Channel list sidebar */}
      <div className="w-64 border-r border-border bg-card hidden md:flex flex-col">
        <div className="p-4 border-b border-border flex items-center justify-between">
          <h2 className="font-semibold flex items-center gap-2">
            <Headphones className="h-5 w-5" />
            Voice Channels
          </h2>
          {isAdmin && (
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7"
              onClick={() => setShowNewChannel((v) => !v)}
              title="New channel"
            >
              <Plus className="h-4 w-4" />
            </Button>
          )}
        </div>

        {/* New channel form */}
        {showNewChannel && isAdmin && (
          <div className="p-3 border-b border-border space-y-2 bg-muted/50">
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Channel name</p>
              <Input
                value={newChannelName}
                onChange={(e) => setNewChannelName(e.target.value)}
                placeholder="e.g. Design team"
                className="h-8 text-sm"
                onKeyDown={(e) => e.key === 'Enter' && handleCreateChannel()}
                autoFocus
              />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Lock className="h-3 w-3" />
                Private channel
              </span>
              <Switch
                checked={newChannelPrivate}
                onCheckedChange={setNewChannelPrivate}
              />
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                className="flex-1 h-7 text-xs"
                onClick={handleCreateChannel}
                disabled={!newChannelName.trim() || createChannel.isPending}
              >
                {createChannel.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Create'}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 text-xs"
                onClick={() => { setShowNewChannel(false); setNewChannelName(''); setNewChannelPrivate(false); }}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}

        {managingChannel && (
          <ChannelMembersDialog
            channel={managingChannel}
            open={!!managingChannel}
            onClose={() => setManagingChannel(null)}
          />
        )}

        <ScrollArea className="flex-1">
          <div className="p-2 space-y-1">
            {isLoading ? (
              <>
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </>
            ) : (
              channels?.map((channel) => (
                <div key={channel.id} className="flex items-start group">
                  <div className="flex-1 min-w-0 relative">
                    {channel.is_private && (
                      <Lock className="absolute top-2 right-2 h-3 w-3 text-muted-foreground z-10 pointer-events-none" />
                    )}
                    <VoiceChannelPanel
                      channel={channel}
                      isActive={currentChannel?.id === channel.id}
                      onJoin={() => joinChannel(channel)}
                    />
                  </div>
                  {isAdmin && !channel.is_default && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button className="opacity-0 group-hover:opacity-100 mt-2 mr-1 h-7 w-7 rounded flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-all flex-shrink-0">
                          <MoreHorizontal className="h-4 w-4" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-44">
                        {channel.is_private && (
                          <DropdownMenuItem onClick={() => setManagingChannel(channel)}>
                            <Lock className="h-3.5 w-3.5 mr-2" />
                            Manage members
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={(e) => handleDeleteChannel(e, channel.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5 mr-2" />
                          Delete channel
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Main content area */}
      <div className="flex-1 flex flex-col bg-background">
        {connectionState === 'connecting' ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Joining {currentChannel?.name ?? 'channel'}…
            </p>
          </div>
        ) : connectionState === 'connected' ? (
          <ErrorBoundary label="voice call">
            <DailyProvider callObject={callObject}>
              <ActiveCallView
                channelName={currentChannel?.name ?? ''}
                connectionState={connectionState}
              />
            </DailyProvider>
          </ErrorBoundary>
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

function IdleView({ channels, isLoading, onJoinChannel }: IdleViewProps) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
      <Headphones className="h-12 w-12 text-muted-foreground mb-4" />
      <p className="text-muted-foreground">Select a channel to join</p>

      {/* Mobile only — sidebar is hidden on mobile */}
      <div className="md:hidden mt-6 space-y-2 w-full max-w-xs">
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
              isActive={false}
              onJoin={() => onJoinChannel(channel)}
            />
          ))
        )}
      </div>
    </div>
  );
}
