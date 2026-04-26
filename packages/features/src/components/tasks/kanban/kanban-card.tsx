'use client';

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Clock, GripVertical, Timer, PauseCircle, CheckCircle2, ClockArrowUp } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage, Badge, cn } from '@taskflow/ui';
import {
  formatCompactDuration,
  getDurationMs,
  DURATION_THRESHOLDS,
  TASK_PRIORITY_CONFIG,
  type TaskWithUsers,
  type TaskPriority,
  type TaskStatus,
} from '@taskflow/core';
import { useNavigation } from '../../../providers/navigation-context';

interface KanbanCardProps {
  task: TaskWithUsers;
  isDragging?: boolean;
  isOverlay?: boolean;
}

function getInitials(name: string) {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export function KanbanCard({ task, isDragging, isOverlay }: KanbanCardProps) {
  const { navigate } = useNavigation();
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging: isSortableDragging,
  } = useSortable({ id: task.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition: transition || 'transform 200ms cubic-bezier(0.25, 1, 0.5, 1)',
    // Subtle fade + scale on the source card while being dragged
    opacity: isSortableDragging ? 0.4 : 1,
    scale: isSortableDragging ? 0.98 : 1,
    // Overlay card: elevated, tilted, follows the cursor
    ...(isOverlay
      ? {
          boxShadow: '0 15px 30px -10px rgba(0,0,0,0.3), 0 5px 15px -5px rgba(0,0,0,0.2)',
          transform: 'rotate(3deg) scale(1.02)',
          cursor: 'grabbing',
        }
      : {}),
  };

  const priorityConfig = TASK_PRIORITY_CONFIG[task.priority as TaskPriority];
  const isAwaitingReview = task.status === 'completed';
  const primaryAssignee = task.assignees?.[0];
  const additionalCount = (task.assignees?.length || 0) - 1;

  const getStatusTimeInfo = () => {
    const status = task.status as TaskStatus;
    switch (status) {
      case 'pending':
        return { timestamp: task.created_at, icon: Clock, label: 'Created' };
      case 'in_progress':
        return {
          timestamp: task.started_at,
          icon: Timer,
          label: 'Started',
          isWarning:
            task.started_at &&
            getDurationMs(task.started_at) > DURATION_THRESHOLDS.IN_PROGRESS_WARNING,
        };
      case 'on_hold':
        return {
          timestamp: task.on_hold_at,
          icon: PauseCircle,
          label: 'On hold',
          isWarning:
            task.on_hold_at &&
            getDurationMs(task.on_hold_at) > DURATION_THRESHOLDS.ON_HOLD_WARNING,
        };
      case 'completed':
        return { timestamp: task.completed_at, icon: ClockArrowUp, label: 'Awaiting review' };
      case 'archived':
        return { timestamp: task.archived_at, icon: CheckCircle2, label: 'Done' };
      default:
        return null;
    }
  };

  const timeInfo = getStatusTimeInfo();
  const formattedTime = timeInfo?.timestamp ? formatCompactDuration(timeInfo.timestamp) : '';
  const TimeIcon = timeInfo?.icon || Clock;

  const handleClick = () => {
    if (!isDragging && !isSortableDragging) {
      navigate(`/tasks/${task.id}`);
    }
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'group bg-card rounded-xl border p-3 cursor-pointer',
        'transition-[box-shadow,border-color] duration-200',
        'hover:shadow-md hover:border-primary/20',
        isAwaitingReview && 'border-t-2 border-t-amber-500',
        isSortableDragging && 'border-dashed border-primary/40',
        isOverlay && 'shadow-2xl border-primary/30 bg-card/95 backdrop-blur-sm'
      )}
      onClick={handleClick}
    >
      <div className="flex items-start gap-2">
        <button
          {...attributes}
          {...listeners}
          className={cn(
            'transition-all duration-150 cursor-grab active:cursor-grabbing p-0.5 -ml-1',
            'text-muted-foreground/50 hover:text-muted-foreground',
            'opacity-40 group-hover:opacity-100',
            isOverlay && 'opacity-100 text-primary'
          )}
          onClick={(e) => e.stopPropagation()}
        >
          <GripVertical className="h-4 w-4" />
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-2">
            <h4 className="text-sm font-medium line-clamp-2 flex-1">{task.title}</h4>
            <span
              className={cn('w-2 h-2 rounded-full flex-shrink-0 mt-1.5', priorityConfig?.color)}
              title={priorityConfig?.label}
            />
          </div>
          {isAwaitingReview && (
            <div className="mb-2">
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30 gap-1">
                <ClockArrowUp className="h-2.5 w-2.5" />
                Awaiting Review
              </Badge>
            </div>
          )}

          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 min-w-0">
              {primaryAssignee ? (
                <>
                  <Avatar className="h-5 w-5 flex-shrink-0">
                    {primaryAssignee.avatar_url && (
                      <AvatarImage src={primaryAssignee.avatar_url} alt={primaryAssignee.name} />
                    )}
                    <AvatarFallback className="text-[8px] bg-muted">
                      {getInitials(primaryAssignee.name)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-xs text-muted-foreground truncate">
                    {primaryAssignee.name.split(' ')[0]}
                    {additionalCount > 0 && ` +${additionalCount}`}
                  </span>
                </>
              ) : (
                <span className="text-xs text-muted-foreground">Unassigned</span>
              )}
            </div>

            {formattedTime && (
              <span
                className={cn(
                  'text-[10px] font-medium whitespace-nowrap flex items-center gap-1 flex-shrink-0',
                  timeInfo?.isWarning ? 'text-amber-500' : 'text-muted-foreground'
                )}
                title={timeInfo?.label}
              >
                <TimeIcon className="h-3 w-3" />
                {formattedTime}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export function KanbanCardOverlay({ task }: { task: TaskWithUsers }) {
  return <KanbanCard task={task} isDragging isOverlay />;
}
