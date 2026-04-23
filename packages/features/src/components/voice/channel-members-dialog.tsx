'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  Button,
  Avatar,
  AvatarFallback,
  AvatarImage,
  Input,
  Skeleton,
} from '@taskflow/ui';
import { Lock, UserPlus, X, Search } from 'lucide-react';
import type { VoiceChannelWithParticipants } from '@taskflow/core';
import { useUsers } from '../../hooks/use-users';
import {
  useVoiceChannelMembers,
  useAddVoiceChannelMember,
  useRemoveVoiceChannelMember,
} from '../../hooks/use-voice-channels';

interface ChannelMembersDialogProps {
  channel: VoiceChannelWithParticipants;
  open: boolean;
  onClose: () => void;
}

export function ChannelMembersDialog({ channel, open, onClose }: ChannelMembersDialogProps) {
  const [search, setSearch] = useState('');

  const { data: members, isLoading: membersLoading } = useVoiceChannelMembers(channel.id);
  const { data: allUsers } = useUsers();
  const addMember = useAddVoiceChannelMember();
  const removeMember = useRemoveVoiceChannelMember();

  const memberIds = new Set(members?.map((m) => m.user_id) ?? []);

  const nonMembers = (allUsers ?? []).filter(
    (u) =>
      !memberIds.has(u.id) &&
      (search === '' ||
        u.name?.toLowerCase().includes(search.toLowerCase()) ||
        u.email?.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md p-0 gap-0">
        {/* Header */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
          <Lock className="h-4 w-4 text-muted-foreground" />
          <h2 className="font-semibold text-sm flex-1 truncate">{channel.name} — Members</h2>
        </div>

        <div className="flex flex-col max-h-[70vh]">
          {/* Current members */}
          <div className="px-4 pt-3 pb-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
              Allowed ({members?.length ?? 0})
            </p>
            {membersLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-9 w-full" />
                <Skeleton className="h-9 w-full" />
              </div>
            ) : members?.length === 0 ? (
              <p className="text-xs text-muted-foreground py-2">No members yet — add users below.</p>
            ) : (
              <div className="space-y-1 max-h-40 overflow-y-auto">
                {members?.map((m) => (
                  <div key={m.user_id} className="flex items-center gap-2 py-1">
                    <Avatar className="h-7 w-7 flex-shrink-0">
                      {m.user?.avatar_url && (
                        <AvatarImage src={m.user.avatar_url} alt={m.user.name || ''} />
                      )}
                      <AvatarFallback className="text-[10px] bg-muted">
                        {m.user?.name?.charAt(0).toUpperCase() ?? '?'}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{m.user?.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{m.user?.email}</p>
                    </div>
                    <button
                      onClick={() => removeMember.mutate({ channelId: channel.id, userId: m.user_id })}
                      disabled={removeMember.isPending}
                      className="h-6 w-6 rounded flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors flex-shrink-0"
                      title="Remove"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="border-t border-border" />

          {/* Add users */}
          <div className="px-4 pt-3 pb-4 flex flex-col gap-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Add users
            </p>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name or email…"
                className="pl-8 h-8 text-sm"
              />
            </div>
            <div className="space-y-1 max-h-48 overflow-y-auto">
              {nonMembers.length === 0 ? (
                <p className="text-xs text-muted-foreground py-2">
                  {search ? 'No users match your search.' : 'All users are already members.'}
                </p>
              ) : (
                nonMembers.map((u) => (
                  <div key={u.id} className="flex items-center gap-2 py-1">
                    <Avatar className="h-7 w-7 flex-shrink-0">
                      {u.avatar_url && <AvatarImage src={u.avatar_url} alt={u.name || ''} />}
                      <AvatarFallback className="text-[10px] bg-muted">
                        {u.name?.charAt(0).toUpperCase() ?? '?'}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{u.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2 text-xs flex-shrink-0"
                      onClick={() => addMember.mutate({ channelId: channel.id, userId: u.id })}
                      disabled={addMember.isPending}
                    >
                      <UserPlus className="h-3.5 w-3.5 mr-1" />
                      Add
                    </Button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="px-4 py-3 border-t border-border flex justify-end">
          <Button size="sm" onClick={onClose}>Done</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
