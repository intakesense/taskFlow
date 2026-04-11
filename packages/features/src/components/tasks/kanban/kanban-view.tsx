'use client';

import { useState, useCallback } from 'react';
import {
  DndContext,
  DragOverlay,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  MeasuringStrategy,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { Plus, Search, X, ClipboardList, UserCheck, PenLine, Users2 } from 'lucide-react';
import {
  Button,
  Input,
  Textarea,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  cn,
} from '@taskflow/ui';
import { KANBAN_COLUMNS, type TaskWithUsers, type TaskStatus } from '@taskflow/core';
import { useMediaQuery } from '../../../hooks/use-media-query';
import { KanbanColumn } from './kanban-column';
import { KanbanCardOverlay } from './kanban-card';
import { KanbanMobile } from './kanban-mobile';
import type { FilterType } from '../types';

interface KanbanViewProps {
  tasks: TaskWithUsers[];
  isLoading: boolean;
  hasMore?: boolean;
  isFetchingMore?: boolean;
  searchQuery: string;
  typeFilter: FilterType;
  currentUserId?: string;
  onSearchChange: (query: string) => void;
  onTypeFilterChange: (type: FilterType) => void;
  onStatusChange: (taskId: string, status: string, onHoldReason?: string) => void;
  onDelete?: (taskId: string) => void;
  onLoadMore?: () => void;
  onCreateTask?: () => void;
  renderProgressFeed?: () => React.ReactNode;
}

const TYPE_OPTIONS: { value: FilterType; icon: typeof ClipboardList; label: string; short: string }[] = [
  { value: 'all', icon: ClipboardList, label: 'All Tasks', short: 'All' },
  { value: 'created', icon: PenLine, label: 'Created', short: 'Created' },
  { value: 'assigned', icon: UserCheck, label: 'Assigned', short: 'Assigned' },
  { value: 'team', icon: Users2, label: 'Team', short: 'Team' },
];

const dropAnimation = {
  duration: 250,
  easing: 'cubic-bezier(0.18, 0.67, 0.6, 1.22)',
};

const measuring = {
  droppable: {
    strategy: MeasuringStrategy.Always,
  },
};

export function KanbanView({
  tasks,
  isLoading,
  hasMore,
  isFetchingMore,
  searchQuery,
  typeFilter,
  currentUserId,
  onSearchChange,
  onTypeFilterChange,
  onStatusChange,
  onDelete,
  onLoadMore,
  onCreateTask,
  renderProgressFeed,
}: KanbanViewProps) {
  const [activeTask, setActiveTask] = useState<TaskWithUsers | null>(null);
  const [activeColumnId, setActiveColumnId] = useState<TaskStatus | null>(null);
  const [mobileStatus, setMobileStatus] = useState<TaskStatus>('pending');

  const [pendingOnHold, setPendingOnHold] = useState<{ taskId: string } | null>(null);
  const [onHoldReason, setOnHoldReason] = useState('');

  const isDesktop = useMediaQuery('(min-width: 768px)');

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 200, tolerance: 5 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const tasksByStatus = KANBAN_COLUMNS.reduce(
    (acc, status) => {
      acc[status] = tasks.filter((t) => t.status === status);
      return acc;
    },
    {} as Record<TaskStatus, TaskWithUsers[]>
  );

  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      const task = tasks.find((t) => t.id === event.active.id);
      if (task) {
        setActiveTask(task);
        setActiveColumnId(task.status as TaskStatus);
        document.body.style.cursor = 'grabbing';
      }
    },
    [tasks]
  );

  const handleDragOver = useCallback(
    (event: DragOverEvent) => {
      const { over } = event;
      if (!over) {
        setActiveColumnId(null);
        return;
      }
      const overId = over.id as string;
      if (KANBAN_COLUMNS.includes(overId as TaskStatus)) {
        setActiveColumnId(overId as TaskStatus);
        return;
      }
      const overTask = tasks.find((t) => t.id === overId);
      if (overTask) setActiveColumnId(overTask.status as TaskStatus);
    },
    [tasks]
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      document.body.style.cursor = '';
      setActiveTask(null);
      setActiveColumnId(null);

      if (!over) return;

      const taskId = active.id as string;
      const task = tasks.find((t) => t.id === taskId);
      if (!task) return;

      const overId = over.id as string;
      let targetStatus: TaskStatus | null = null;

      if (KANBAN_COLUMNS.includes(overId as TaskStatus)) {
        targetStatus = overId as TaskStatus;
      } else {
        const targetTask = tasks.find((t) => t.id === overId);
        if (targetTask) targetStatus = targetTask.status as TaskStatus;
      }

      if (targetStatus && targetStatus !== task.status) {
        if (targetStatus === 'on_hold') {
          setPendingOnHold({ taskId });
          setOnHoldReason('');
        } else {
          onStatusChange(taskId, targetStatus);
        }
      }
    },
    [tasks, onStatusChange]
  );

  const handleDragCancel = useCallback(() => {
    document.body.style.cursor = '';
    setActiveTask(null);
    setActiveColumnId(null);
  }, []);

  const handleOnHoldConfirm = () => {
    if (pendingOnHold && onHoldReason.trim()) {
      onStatusChange(pendingOnHold.taskId, 'on_hold', onHoldReason.trim());
      setPendingOnHold(null);
      setOnHoldReason('');
    }
  };

  const handleOnHoldCancel = () => {
    setPendingOnHold(null);
    setOnHoldReason('');
  };

  return (
    <div className="flex flex-col h-screen bg-background">
      <div className="flex-shrink-0 px-4 pt-4 pb-3 border-b bg-card sticky top-0 z-10 space-y-3">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold">Tasks</h1>
          <div className="flex items-center gap-2">
            {renderProgressFeed?.()}
            {onCreateTask && (
              <Button size="icon" onClick={onCreateTask} className="h-9 w-9 rounded-full">
                <Plus className="h-5 w-5" />
              </Button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-4 gap-1 rounded-lg bg-muted p-1">
          {TYPE_OPTIONS.map(({ value, icon: Icon, label, short }) => (
            <button
              key={value}
              onClick={() => onTypeFilterChange(value)}
              className={cn(
                'flex items-center justify-center gap-1.5 px-2 py-2 rounded-md text-xs font-medium transition-all',
                typeFilter === value
                  ? 'bg-background shadow-sm text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <Icon className="h-3.5 w-3.5 shrink-0" />
              <span className="hidden sm:inline">{label}</span>
              <span className="sm:hidden">{short}</span>
            </button>
          ))}
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search tasks..."
            className="pl-9 rounded-full bg-muted/50 border-0 focus-visible:ring-1 h-9"
          />
          {searchQuery && (
            <button
              onClick={() => onSearchChange('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : isDesktop ? (
        <div className="flex-1 overflow-x-auto overflow-y-auto">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            measuring={measuring}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
            onDragCancel={handleDragCancel}
          >
            <div className="flex gap-4 p-4 min-w-max">
              {KANBAN_COLUMNS.map((status) => (
                <KanbanColumn
                  key={status}
                  status={status}
                  tasks={tasksByStatus[status]}
                  isOver={activeColumnId === status && activeTask?.status !== status}
                />
              ))}
            </div>

            <DragOverlay dropAnimation={dropAnimation}>
              {activeTask && <KanbanCardOverlay task={activeTask} />}
            </DragOverlay>
          </DndContext>
          {hasMore && (
            <div className="flex justify-center pb-6">
              <Button variant="outline" size="sm" onClick={onLoadMore} disabled={isFetchingMore}>
                {isFetchingMore ? 'Loading...' : 'Load more'}
              </Button>
            </div>
          )}
        </div>
      ) : (
        <KanbanMobile
          tasks={tasks}
          selectedStatus={mobileStatus}
          onStatusSelect={setMobileStatus}
          onStatusChange={onStatusChange}
          onDelete={(taskId) => onDelete?.(taskId)}
          currentUserId={currentUserId}
        />
      )}

      <Dialog open={!!pendingOnHold} onOpenChange={(open) => !open && handleOnHoldCancel()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Put Task On Hold</DialogTitle>
            <DialogDescription>
              Please provide a reason for putting this task on hold. This helps the team understand
              why work has been paused.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={onHoldReason}
            onChange={(e) => setOnHoldReason(e.target.value)}
            placeholder="e.g., Waiting for design approval, Blocked by dependency..."
            className="min-h-[100px]"
            autoFocus
          />
          <DialogFooter>
            <Button variant="outline" onClick={handleOnHoldCancel}>
              Cancel
            </Button>
            <Button onClick={handleOnHoldConfirm} disabled={!onHoldReason.trim()}>
              Put On Hold
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}