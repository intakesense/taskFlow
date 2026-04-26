'use client';

import type { TaskAuditLogWithUser, TaskAuditAction } from '@taskflow/core';
import { STATUS_CONFIG } from '@taskflow/core';
import { formatRelative, formatDateTime } from '@taskflow/core';
import { Avatar, AvatarFallback, AvatarImage, Badge, cn } from '@taskflow/ui';
import {
  Clock,
  UserPlus,
  UserMinus,
  PenLine,
  CheckCircle2,
  ClockArrowUp,
} from 'lucide-react';

interface TaskActivityFeedProps {
  entries: TaskAuditLogWithUser[];
}

function getInitials(name: string) {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

// Left border color per action category
const ACTION_BORDER: Record<TaskAuditAction, string> = {
  created: 'border-l-emerald-500',
  status_change: 'border-l-blue-500',
  field_update: 'border-l-border',
  assignee_add: 'border-l-violet-500',
  assignee_remove: 'border-l-violet-500',
  deleted: 'border-l-destructive',
};

// Small icon per action category
const ACTION_ICON: Record<TaskAuditAction, React.ElementType> = {
  created: CheckCircle2,
  status_change: ClockArrowUp,
  field_update: PenLine,
  assignee_add: UserPlus,
  assignee_remove: UserMinus,
  deleted: Clock,
};

function StatusPill({ status }: { status: string }) {
  const config = STATUS_CONFIG[status as keyof typeof STATUS_CONFIG];
  if (!config) return <span className="font-medium">{status}</span>;
  return (
    <Badge variant="outline" className={cn('text-[10px] px-1.5 py-0 h-4', config.color)}>
      {config.label}
    </Badge>
  );
}

function buildSentence(entry: TaskAuditLogWithUser): React.ReactNode {
  const actor = entry.user?.name ?? 'A former team member';

  switch (entry.action) {
    case 'created':
      return <><span className="font-medium">{actor}</span> created this task</>;

    case 'status_change': {
      const from = entry.old_value?.status as string | undefined;
      const to = entry.new_value?.status as string | undefined;
      const reason = entry.new_value?.on_hold_reason as string | undefined;

      if (to === 'on_hold') {
        return (
          <>
            <span className="font-medium">{actor}</span> put on hold
            {reason && (
              <span className="text-muted-foreground italic"> · "{reason}"</span>
            )}
          </>
        );
      }
      return (
        <>
          <span className="font-medium">{actor}</span>{' '}
          changed status
          {from && <> from <StatusPill status={from} /></>}
          {to && <> to <StatusPill status={to} /></>}
        </>
      );
    }

    case 'field_update': {
      const field = entry.new_value?.field as string | undefined;
      const newVal = entry.new_value?.value as string | undefined;
      if (field === 'title') {
        return (
          <>
            <span className="font-medium">{actor}</span> renamed to{' '}
            <span className="font-medium">"{newVal}"</span>
          </>
        );
      }
      if (field === 'priority') {
        return (
          <>
            <span className="font-medium">{actor}</span> changed priority to{' '}
            <span className="font-medium capitalize">{newVal}</span>
          </>
        );
      }
      if (field === 'deadline') {
        return (
          <>
            <span className="font-medium">{actor}</span>{' '}
            {newVal ? <>set deadline to <span className="font-medium">{formatDateTime(newVal)}</span></> : 'removed the deadline'}
          </>
        );
      }
      if (field === 'description') {
        return <><span className="font-medium">{actor}</span> updated the description</>;
      }
      return (
        <>
          <span className="font-medium">{actor}</span> updated{' '}
          <span className="font-medium">{field}</span>
        </>
      );
    }

    case 'assignee_add': {
      const name = entry.new_value?.user_name as string | undefined;
      return (
        <>
          <span className="font-medium">{actor}</span> added{' '}
          <span className="font-medium">{name ?? 'someone'}</span> as assignee
        </>
      );
    }

    case 'assignee_remove': {
      const name = entry.old_value?.user_name as string | undefined;
      return (
        <>
          <span className="font-medium">{actor}</span> removed{' '}
          <span className="font-medium">{name ?? 'someone'}</span>
        </>
      );
    }

    case 'deleted':
      return <><span className="font-medium">{actor}</span> deleted this task</>;

    default:
      return <><span className="font-medium">{actor}</span> made a change</>;
  }
}

export function TaskActivityFeed({ entries }: TaskActivityFeedProps) {
  if (entries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-center gap-2">
        <Clock className="h-8 w-8 text-muted-foreground/40" />
        <p className="text-sm text-muted-foreground">No activity yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {entries.map((entry) => {
        const Icon = ACTION_ICON[entry.action] ?? Clock;
        const borderColor = ACTION_BORDER[entry.action] ?? 'border-l-border';

        return (
          <div
            key={entry.id}
            className={cn(
              'flex items-start gap-3 px-3 py-2.5 rounded-lg',
              'border-l-2 bg-muted/30 hover:bg-muted/50 transition-colors',
              borderColor
            )}
          >
            {/* Avatar */}
            <Avatar className="h-6 w-6 shrink-0 mt-0.5">
              {entry.user?.avatar_url && (
                <AvatarImage src={entry.user.avatar_url} alt={entry.user.name} />
              )}
              <AvatarFallback className="text-[9px] bg-muted">
                {entry.user ? getInitials(entry.user.name) : '?'}
              </AvatarFallback>
            </Avatar>

            {/* Sentence + time */}
            <div className="flex-1 min-w-0">
              <p className="text-sm leading-snug">{buildSentence(entry)}</p>
              <p
                className="text-[11px] text-muted-foreground mt-0.5 cursor-default"
                title={formatDateTime(entry.created_at)}
              >
                {formatRelative(entry.created_at)}
              </p>
            </div>

            {/* Action icon */}
            <Icon className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0 mt-1" />
          </div>
        );
      })}
    </div>
  );
}
