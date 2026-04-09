import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Clock, CircleDashed, PauseCircle, CheckCircle2 } from 'lucide-react';
import { cn } from '@taskflow/ui';
import { TASK_STATUS_CONFIG, type TaskStatus, type TaskWithUsers } from '@taskflow/core';
import { KanbanCard } from './kanban-card';

interface KanbanColumnProps {
  status: TaskStatus;
  tasks: TaskWithUsers[];
  isOver?: boolean;
}

// Map icon names to actual icons
const STATUS_ICONS = {
  CircleDashed,
  Clock,
  PauseCircle,
  CheckCircle2,
} as const;

export function KanbanColumn({ status, tasks, isOver }: KanbanColumnProps) {
  const { setNodeRef, isOver: isDroppableOver } = useDroppable({ id: status });
  const config = TASK_STATUS_CONFIG[status];
  const Icon = STATUS_ICONS[config.iconName as keyof typeof STATUS_ICONS] || Clock;

  const taskIds = tasks.map((t) => t.id);
  const isActive = isOver || isDroppableOver;

  return (
    <div className="flex flex-col min-w-[280px] max-w-[320px] w-full">
      <div className="flex items-center gap-2 px-3 py-2 mb-2">
        <div className={cn('p-1.5 rounded-lg', config.bg)}>
          <Icon className={cn('h-4 w-4', config.color)} />
        </div>
        <h3 className="font-semibold text-sm">{config.label}</h3>
        <span className="text-xs text-muted-foreground tabular-nums ml-auto">{tasks.length}</span>
      </div>

      <div
        ref={setNodeRef}
        className={cn(
          'flex-1 rounded-xl p-2 space-y-2 min-h-[200px] transition-colors',
          'bg-muted/30 border-2 border-dashed border-transparent',
          isActive && 'border-primary/30 bg-primary/5'
        )}
      >
        <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
          {tasks.length === 0 ? (
            <div className="flex items-center justify-center h-24 text-xs text-muted-foreground">
              No tasks
            </div>
          ) : (
            tasks.map((task) => <KanbanCard key={task.id} task={task} />)
          )}
        </SortableContext>
      </div>
    </div>
  );
}
