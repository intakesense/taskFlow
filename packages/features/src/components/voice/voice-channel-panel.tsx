'use client';

import { cn, Avatar, AvatarFallback, AvatarImage } from '@taskflow/ui';
import { Headphones } from 'lucide-react';
import type { VoiceChannelWithParticipants } from '@taskflow/core';

interface VoiceChannelPanelProps {
  channel: VoiceChannelWithParticipants;
  isActive: boolean;
  onJoin: () => void;
}

export function VoiceChannelPanel({
  channel,
  isActive,
  onJoin,
}: VoiceChannelPanelProps) {
  return (
    <button
      onClick={onJoin}
      disabled={isActive}
      className={cn(
        'w-full text-left p-3 rounded-lg transition-colors',
        isActive
          ? 'bg-primary text-primary-foreground cursor-default'
          : 'hover:bg-muted'
      )}
    >
      <div className="flex items-center gap-2">
        <Headphones className="h-4 w-4 shrink-0" />
        <span className="font-medium truncate">{channel.name}</span>
        {channel.participantCount > 0 && (
          <span className="ml-auto text-xs opacity-70 tabular-nums">
            {channel.participantCount}
          </span>
        )}
      </div>

      {channel.participants.length > 0 && (
        <div className="mt-2 space-y-1">
          {channel.participants.map((participant) => (
            <div
              key={participant.user_id}
              className={cn(
                'flex items-center gap-2 pl-6 text-sm',
                isActive ? 'opacity-90' : 'opacity-70'
              )}
            >
              <Avatar className="h-5 w-5">
                <AvatarImage src={participant.user.avatar_url || undefined} />
                <AvatarFallback className="text-[10px]">
                  {participant.user.name?.charAt(0).toUpperCase() || '?'}
                </AvatarFallback>
              </Avatar>
              <span className="truncate flex-1">{participant.user.name}</span>
            </div>
          ))}
        </div>
      )}
    </button>
  );
}
