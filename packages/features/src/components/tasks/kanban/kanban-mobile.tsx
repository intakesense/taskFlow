import { Clock, CircleDashed, PauseCircle, CheckCircle2, ClockArrowUp } from 'lucide-react';
import { cn } from '@taskflow/ui';
import { TASK_STATUS_CONFIG, KANBAN_COLUMNS, type TaskWithUsers, type TaskStatus } from '@taskflow/core';
import { SwipeableTaskCard } from '../swipeable-task-card';

interface KanbanMobileProps {
  tasks: TaskWithUsers[];
  selectedStatus: TaskStatus;
  onStatusSelect: (status: TaskStatus) => void;
  onStatusChange: (taskId: string, status: string, onHoldReason?: string) => void;
  onDelete: (taskId: string) => void;
  currentUserId?: string;
}

// Map icon names to actual icons
const STATUS_ICONS = {
  CircleDashed,
  Clock,
  PauseCircle,
  ClockArrowUp,
  CheckCircle2,
} as const;

export function KanbanMobile({
  tasks,
  selectedStatus,
  onStatusSelect,
  onStatusChange,
  onDelete,
  currentUserId,
}: KanbanMobileProps) {
  const tasksByStatus = KANBAN_COLUMNS.reduce(
    (acc, status) => {
      acc[status] = tasks.filter((t) =>
        status === 'in_progress'
          ? t.status === 'in_progress' || t.status === 'completed'
          : t.status === status
      );
      return acc;
    },
    {} as Record<TaskStatus, TaskWithUsers[]>
  );

  const currentTasks = tasksByStatus[selectedStatus] || [];

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <div className="flex gap-1 px-4 py-2 overflow-x-auto no-scrollbar border-b bg-card">
        {KANBAN_COLUMNS.map((status) => {
          const config = TASK_STATUS_CONFIG[status];
          const count = tasksByStatus[status]?.length || 0;
          const Icon = STATUS_ICONS[config.iconName as keyof typeof STATUS_ICONS] || Clock;

          return (
            <button
              key={status}
              onClick={() => onStatusSelect(status)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all',
                selectedStatus === status
                  ? `${config.bg} ${config.color}`
                  : 'bg-muted/50 text-muted-foreground hover:bg-muted'
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              <span>{config.label}</span>
              <span className="tabular-nums">({count})</span>
            </button>
          );
        })}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {currentTasks.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-sm text-muted-foreground">
            No {TASK_STATUS_CONFIG[selectedStatus].label.toLowerCase()} tasks
          </div>
        ) : (
          currentTasks.map((task) => (
            <SwipeableTaskCard
              key={task.id}
              task={task}
              onStatusChange={onStatusChange}
              onDelete={onDelete}
              currentUserId={currentUserId}
            />
          ))
        )}
      </div>
    </div>
  );
}
