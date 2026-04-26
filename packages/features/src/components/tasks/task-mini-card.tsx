'use client';

import { Clock, CheckCircle2, Timer, PauseCircle, ClockArrowUp } from 'lucide-react';
import { cn } from '@taskflow/ui';
import {
  formatCompactDuration,
  getDurationMs,
  DURATION_THRESHOLDS,
  type TaskWithUsers,
  type TaskStatus,
  type TaskPriority,
} from '@taskflow/core';
import { useNavigation } from '../../providers/navigation-context';

interface TaskMiniCardProps {
  task: TaskWithUsers;
}

const STATUS_CONFIG: Record<TaskStatus, { label: string; color: string; icon: typeof Clock }> = {
  pending: { label: 'Pending', color: 'text-amber-600 bg-amber-500/10', icon: Clock },
  in_progress: { label: 'In Progress', color: 'text-blue-600 bg-blue-500/10', icon: Clock },
  on_hold: { label: 'On Hold', color: 'text-yellow-600 bg-yellow-500/10', icon: Clock },
  completed: { label: 'Awaiting Review', color: 'text-amber-600 bg-amber-500/10', icon: ClockArrowUp },
  archived: { label: 'Done', color: 'text-emerald-600 bg-emerald-500/10', icon: CheckCircle2 },
};

const PRIORITY_COLOR: Record<TaskPriority, string> = {
  low: 'bg-blue-500',
  medium: 'bg-yellow-500',
  high: 'bg-red-500',
};

export function TaskMiniCard({ task }: TaskMiniCardProps) {
  const { Link } = useNavigation();
  const status = STATUS_CONFIG[task.status as TaskStatus] || STATUS_CONFIG.pending;
  const StatusIcon = status.icon;

  const getStatusTimeInfo = () => {
    const taskStatus = task.status as TaskStatus;
    switch (taskStatus) {
      case 'pending':
        return { timestamp: task.created_at, icon: Clock };
      case 'in_progress':
        return {
          timestamp: task.started_at,
          icon: Timer,
          isWarning:
            task.started_at &&
            getDurationMs(task.started_at) > DURATION_THRESHOLDS.IN_PROGRESS_WARNING,
        };
      case 'on_hold':
        return {
          timestamp: task.on_hold_at,
          icon: PauseCircle,
          isWarning:
            task.on_hold_at && getDurationMs(task.on_hold_at) > DURATION_THRESHOLDS.ON_HOLD_WARNING,
        };
      case 'completed':
        return { timestamp: (task as TaskWithUsers & { completed_at?: string | null }).completed_at, icon: ClockArrowUp };
      case 'archived':
        return { timestamp: task.archived_at, icon: CheckCircle2 };
      default:
        return null;
    }
  };

  const timeInfo = getStatusTimeInfo();
  const formattedTime = timeInfo?.timestamp ? formatCompactDuration(timeInfo.timestamp) : '';
  const TimeIcon = timeInfo?.icon || Clock;

  return (
    <Link
      href={`/tasks/${task.id}`}
      className={cn(
        'block px-3 py-2.5 rounded-xl bg-muted/50 transition-colors',
        'hover:bg-muted active:scale-[0.99]'
      )}
    >
      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{task.title}</p>
          <div className="flex items-center gap-2 mt-1">
            <span
              className={cn(
                'inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium',
                status.color
              )}
            >
              <StatusIcon className="h-2.5 w-2.5" />
              {status.label}
            </span>
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-muted text-[10px] font-medium text-muted-foreground">
              <span
                className={cn('w-1.5 h-1.5 rounded-full', PRIORITY_COLOR[task.priority as TaskPriority])}
              />
              {task.priority}
            </span>
          </div>
        </div>
        {formattedTime && (
          <span
            className={cn(
              'text-[10px] font-medium whitespace-nowrap flex items-center gap-1',
              timeInfo?.isWarning ? 'text-amber-500' : 'text-muted-foreground'
            )}
          >
            <TimeIcon className="h-2.5 w-2.5" />
            {formattedTime}
          </span>
        )}
      </div>
    </Link>
  );
}
