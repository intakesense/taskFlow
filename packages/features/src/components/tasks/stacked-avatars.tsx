'use client';

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
  cn,
} from '@taskflow/ui';
import type { UserBasic, AssigneeWithDetails } from '@taskflow/core';

interface StackedAvatarsProps {
  users: (UserBasic | AssigneeWithDetails)[];
  max?: number;
  size?: 'sm' | 'md' | 'lg';
  showTooltip?: boolean;
  className?: string;
}

const sizeClasses = {
  sm: 'h-6 w-6 text-[10px]',
  md: 'h-8 w-8 text-xs',
  lg: 'h-10 w-10 text-sm',
};

const overlapClasses = {
  sm: '-space-x-1.5',
  md: '-space-x-2',
  lg: '-space-x-2.5',
};

function getInitials(name: string) {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export function StackedAvatars({
  users,
  max = 3,
  size = 'md',
  showTooltip = true,
  className,
}: StackedAvatarsProps) {
  const visibleUsers = users.slice(0, max);
  const remainingCount = users.length - max;

  const avatarsContent = (
    <div className={cn('flex', overlapClasses[size], className)}>
      {visibleUsers.map((user, index) => (
        <Avatar
          key={user.id}
          className={cn(
            sizeClasses[size],
            'border-2 border-background font-medium'
          )}
          style={{ zIndex: max - index }}
        >
          {user.avatar_url ? (
            <AvatarImage src={user.avatar_url} alt={user.name} />
          ) : null}
          <AvatarFallback className="bg-primary text-primary-foreground">
            {getInitials(user.name)}
          </AvatarFallback>
        </Avatar>
      ))}
      {remainingCount > 0 && (
        <Avatar
          className={cn(
            sizeClasses[size],
            'border-2 border-background font-medium'
          )}
        >
          <AvatarFallback className="bg-muted text-muted-foreground">
            +{remainingCount}
          </AvatarFallback>
        </Avatar>
      )}
    </div>
  );

  if (!showTooltip || users.length === 0) {
    return avatarsContent;
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>{avatarsContent}</TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs">
          <div className="text-sm">
            {users.length === 1 ? (
              <span>{users[0].name}</span>
            ) : (
              <div className="space-y-1">
                <div className="font-medium">{users.length} assignees</div>
                <div className="text-muted-foreground">
                  {users.map((u) => u.name).join(', ')}
                </div>
              </div>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
