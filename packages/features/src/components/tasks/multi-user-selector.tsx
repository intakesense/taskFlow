'use client';

import { useState } from 'react';
import { Search, Check, ChevronRight, X, Users } from 'lucide-react';
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  Input,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Button,
  cn,
} from '@taskflow/ui';
import { EMPLOYEE_LEVEL_COLORS, type User } from '@taskflow/core';
import { useAssignableUsers } from '../../hooks';
import { useAuth } from '../../providers/auth-context';

interface MultiUserSelectorProps {
  selectedUserIds: string[];
  onSelectUsers: (userIds: string[]) => void;
  maxSelections?: number;
}

export function MultiUserSelector({
  selectedUserIds,
  onSelectUsers,
  maxSelections,
}: MultiUserSelectorProps) {
  const { effectiveUser } = useAuth();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const { data: users = [], isLoading } = useAssignableUsers(effectiveUser?.level);

  const selectedUsers = users.filter((u) => selectedUserIds.includes(u.id));

  const filteredUsers = users
    .filter((user) => user.id !== effectiveUser?.id)
    .filter(
      (user) =>
        !search.trim() ||
        user.name.toLowerCase().includes(search.toLowerCase()) ||
        user.email.toLowerCase().includes(search.toLowerCase())
    );

  const handleToggleUser = (user: User) => {
    if (selectedUserIds.includes(user.id)) {
      onSelectUsers(selectedUserIds.filter((id) => id !== user.id));
    } else {
      if (maxSelections && selectedUserIds.length >= maxSelections) {
        return;
      }
      onSelectUsers([...selectedUserIds, user.id]);
    }
  };

  const handleRemoveUser = (userId: string) => {
    onSelectUsers(selectedUserIds.filter((id) => id !== userId));
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          'w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl transition-all',
          'bg-muted/50 hover:bg-muted',
          selectedUsers.length > 0 && 'bg-primary/5'
        )}
      >
        {selectedUsers.length > 0 ? (
          <>
            <div className="flex -space-x-1.5">
              {selectedUsers.slice(0, 3).map((user, index) => (
                <Avatar
                  key={user.id}
                  className="h-7 w-7 border-2 border-background"
                  style={{ zIndex: 3 - index }}
                >
                  {user.avatar_url ? <AvatarImage src={user.avatar_url} alt={user.name} /> : null}
                  <AvatarFallback className="bg-primary text-primary-foreground text-[10px] font-medium">
                    {getInitials(user.name)}
                  </AvatarFallback>
                </Avatar>
              ))}
              {selectedUsers.length > 3 && (
                <Avatar className="h-7 w-7 border-2 border-background">
                  <AvatarFallback className="bg-muted text-muted-foreground text-[10px] font-medium">
                    +{selectedUsers.length - 3}
                  </AvatarFallback>
                </Avatar>
              )}
            </div>
            <span className="flex-1 text-left text-sm font-medium truncate">
              {selectedUsers.length === 1 ? selectedUsers[0].name : `${selectedUsers.length} people`}
            </span>
            <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          </>
        ) : (
          <>
            <div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
              <Users className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
            <span className="flex-1 text-left text-sm text-muted-foreground">Select people</span>
            <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          </>
        )}
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-sm p-0 gap-0 max-h-[70vh] flex flex-col rounded-2xl">
          <DialogHeader className="px-4 pt-4 pb-3 border-b">
            <DialogTitle className="text-center text-base font-semibold">Assign to</DialogTitle>
          </DialogHeader>

          {selectedUsers.length > 0 && (
            <div className="px-3 py-2.5 border-b flex flex-wrap gap-1.5">
              {selectedUsers.map((user) => (
                <div
                  key={user.id}
                  className="flex items-center gap-1 pl-1.5 pr-1.5 py-0.5 rounded-full bg-primary/10 text-primary text-xs"
                >
                  <Avatar className="h-4 w-4">
                    {user.avatar_url ? <AvatarImage src={user.avatar_url} alt={user.name} /> : null}
                    <AvatarFallback className="bg-primary text-primary-foreground text-[8px]">
                      {getInitials(user.name)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="font-medium">{user.name.split(' ')[0]}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveUser(user.id)}
                    className="hover:bg-primary/20 rounded-full p-0.5 -mr-0.5"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="px-3 py-2.5 border-b">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search..."
                className="h-9 pl-8 text-sm rounded-lg bg-muted/50 border-0"
                autoFocus
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {isLoading ? (
              <div className="p-6 text-center text-muted-foreground text-sm">
                <div className="h-5 w-5 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                Loading...
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="p-6 text-center text-muted-foreground text-sm">
                {search ? 'No results' : 'No assignable users'}
              </div>
            ) : (
              <div className="py-1">
                {filteredUsers.map((user) => {
                  const isSelected = selectedUserIds.includes(user.id);
                  const isDisabled =
                    !isSelected && !!maxSelections && selectedUserIds.length >= maxSelections;
                  return (
                    <button
                      key={user.id}
                      type="button"
                      onClick={() => handleToggleUser(user)}
                      disabled={isDisabled}
                      className={cn(
                        'w-full flex items-center gap-2.5 px-3 py-2 transition-colors',
                        'hover:bg-muted/50',
                        isSelected && 'bg-primary/5',
                        isDisabled && 'opacity-50 cursor-not-allowed'
                      )}
                    >
                      <Avatar className="h-8 w-8 flex-shrink-0">
                        {user.avatar_url ? (
                          <AvatarImage src={user.avatar_url} alt={user.name} />
                        ) : null}
                        <AvatarFallback
                          className={cn(
                            'text-xs font-medium',
                            isSelected ? 'bg-primary text-primary-foreground' : 'bg-muted'
                          )}
                        >
                          {getInitials(user.name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0 text-left">
                        <div className="text-sm font-medium truncate">{user.name}</div>
                        <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                          <span
                            className={cn(
                              'px-1 py-px rounded text-white text-[9px] font-medium',
                              EMPLOYEE_LEVEL_COLORS[user.level] || 'bg-gray-500'
                            )}
                          >
                            L{user.level}
                          </span>
                          <span className="truncate">{user.email}</span>
                        </div>
                      </div>
                      <div
                        className={cn(
                          'h-4 w-4 rounded-full border-2 flex items-center justify-center flex-shrink-0',
                          isSelected ? 'bg-primary border-primary' : 'border-muted-foreground/30'
                        )}
                      >
                        {isSelected && <Check className="h-2.5 w-2.5 text-primary-foreground" />}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="px-3 py-2.5 border-t flex gap-2">
            {selectedUserIds.length > 0 && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onSelectUsers([])}
                className="text-xs h-8"
              >
                Clear
              </Button>
            )}
            <Button
              type="button"
              onClick={() => setOpen(false)}
              size="sm"
              className="flex-1 rounded-lg h-8 text-xs"
            >
              Done{selectedUserIds.length > 0 && ` (${selectedUserIds.length})`}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
