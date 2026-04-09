import {
  cn,
  Card,
  CardContent,
  Badge,
} from '@taskflow/ui';
import { Calendar, User } from 'lucide-react';
import type { TaskWithUsers } from '@taskflow/core';
import { STATUS_CONFIG, PRIORITY_CONFIG, formatDateShort } from '@taskflow/core';
import { NavigationLink } from '../primitives/navigation-link';

interface TaskCardProps {
  task: TaskWithUsers;
  onClick?: () => void;
}

function StatusBadge({ status }: { status: string }) {
  const config = STATUS_CONFIG[status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.pending;
  return <Badge variant="outline" className={config.color}>{config.label}</Badge>;
}

function PriorityDot({ priority }: { priority: string }) {
  const config = PRIORITY_CONFIG[priority as keyof typeof PRIORITY_CONFIG] || PRIORITY_CONFIG.low;
  return <span className={cn('w-2 h-2 rounded-full', config.dotColor)} />;
}

export function TaskCard({ task, onClick }: TaskCardProps) {
  return (
    <NavigationLink
      href={`/tasks/${task.id}`}
      onClick={onClick}
      className="block"
    >
      <Card className="bg-card/50 border-border hover:bg-card transition-colors cursor-pointer group" data-slot="card">
        <CardContent className="p-4 lg:p-6">
          <div className="flex flex-col lg:flex-row lg:items-center gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 mb-2">
                <PriorityDot priority={task.priority} />
                <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors truncate">
                  {task.title}
                </h3>
              </div>
              {task.description && (
                <p className="text-sm text-muted-foreground line-clamp-1 mb-3">
                  {task.description}
                </p>
              )}
              <div className="flex flex-wrap items-center gap-3 text-sm">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <User className="h-4 w-4" />
                  <span>From: {task.assigner?.name}</span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <span>To: {task.assignees?.length === 1
                    ? task.assignees[0].name
                    : task.assignees?.length
                      ? `${task.assignees.length} people`
                      : 'Unassigned'}</span>
                </div>
                {task.deadline && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Calendar className="h-4 w-4" />
                    <span>{formatDateShort(task.deadline)}</span>
                  </div>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <StatusBadge status={task.status} />
            </div>
          </div>
        </CardContent>
      </Card>
    </NavigationLink>
  );
}
