'use client';

import { useState, useMemo } from 'react';
import { m, AnimatePresence, useReducedMotion } from 'framer-motion';
import {
  cn,
  Button,
  Input,
  Card,
  CardContent,
  taskCardVariants,
  listContainerVariants,
} from '@taskflow/ui';
import {
  Plus,
  Search,
  Loader2,
  ClipboardList,
  UserCheck,
  PenLine,
} from 'lucide-react';
import type { TaskStatus as TaskStatusType, TaskWithUsers } from '@taskflow/core';
import { useTasks } from '../../hooks/use-tasks';
import { useAuth } from '../../providers/auth-context';
import { NavigationLink } from '../primitives/navigation-link';
import { TaskCard } from './task-card';

// Types
export type FilterType = 'all' | 'assigned' | 'created';

// Type filter config
const TYPE_FILTER_OPTIONS: { value: FilterType; icon: typeof ClipboardList; label: string }[] = [
  { value: 'all', icon: ClipboardList, label: 'All Tasks' },
  { value: 'assigned', icon: UserCheck, label: 'Assigned' },
  { value: 'created', icon: PenLine, label: 'Created' },
];

// Status chip config
const STATUS_CHIP_OPTIONS: { value: TaskStatusType | 'all'; label: string; dot?: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'pending', label: 'Pending', dot: 'bg-amber-500' },
  { value: 'in_progress', label: 'In Progress', dot: 'bg-blue-500' },
  { value: 'completed', label: 'Awaiting Review', dot: 'bg-amber-400' },
  { value: 'archived', label: 'Completed', dot: 'bg-emerald-500' },
];

// Animated task card wrapper
function AnimatedTaskCard({ task, index }: { task: TaskWithUsers; index: number }) {
  const prefersReducedMotion = useReducedMotion();

  return (
    <m.div
      layout
      variants={prefersReducedMotion ? undefined : taskCardVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      whileHover={prefersReducedMotion ? undefined : "hover"}
      whileTap={prefersReducedMotion ? undefined : "tap"}
      custom={index}
    >
      <TaskCard task={task} />
    </m.div>
  );
}

export function TasksView() {
  const { effectiveUser } = useAuth();
  const { data: tasks = [], isLoading } = useTasks();

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<TaskStatusType | 'all'>('all');
  const [typeFilter, setTypeFilter] = useState<FilterType>('all');

  // Filter tasks
  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        if (
          !task.title.toLowerCase().includes(query) &&
          !task.description?.toLowerCase().includes(query)
        ) {
          return false;
        }
      }

      // Status filter
      if (statusFilter !== 'all' && task.status !== statusFilter) {
        return false;
      }

      // Type filter
      if (typeFilter === 'assigned' && !task.assignees?.some(a => a.id === effectiveUser?.id)) {
        return false;
      }
      if (typeFilter === 'created' && task.assigned_by !== effectiveUser?.id) {
        return false;
      }

      return true;
    });
  }, [tasks, searchQuery, statusFilter, typeFilter, effectiveUser?.id]);

  return (
    <div className="p-6 lg:p-8 space-y-5">
      {/* Header row */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-foreground">Tasks</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            Manage and track your work
          </p>
        </div>
        <NavigationLink href="/tasks/new">
          <Button size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90">
            <Plus className="h-4 w-4 mr-1.5" />
            New
          </Button>
        </NavigationLink>
      </div>

      {/* Primary view switcher (segmented control) */}
      <div className="space-y-3">
        <div className="grid grid-cols-3 gap-1.5 rounded-lg bg-muted p-1">
          {TYPE_FILTER_OPTIONS.map(({ value, icon: Icon, label }) => (
            <button
              key={value}
              onClick={() => setTypeFilter(value)}
              className={cn(
                'flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium transition-all',
                typeFilter === value
                  ? 'bg-background shadow-sm text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <Icon className="h-4 w-4" />
              <span className="hidden sm:inline">{label}</span>
              <span className="sm:hidden">{value === 'all' ? 'All' : value === 'assigned' ? 'Assigned' : 'Created'}</span>
            </button>
          ))}
        </div>

        {/* Search + Status chips row */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search tasks..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Status filter chips */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
            {STATUS_CHIP_OPTIONS.map(({ value, label, dot }) => (
              <button
                key={value}
                onClick={() => setStatusFilter(value)}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap border transition-all',
                  statusFilter === value
                    ? 'bg-foreground/10 border-foreground/20 text-foreground'
                    : 'bg-transparent border-border text-muted-foreground hover:text-foreground hover:border-foreground/20'
                )}
              >
                {dot && <span className={cn('w-1.5 h-1.5 rounded-full', dot)} />}
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Task list */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : filteredTasks.length === 0 ? (
        <Card className="bg-card/50 border-border" data-slot="card">
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">No tasks found</p>
            <NavigationLink href="/tasks/new" className="mt-4 inline-block">
              <Button variant="outline" className="mt-2">
                <Plus className="h-4 w-4 mr-2" />
                Create your first task
              </Button>
            </NavigationLink>
          </CardContent>
        </Card>
      ) : (
        <m.div
          className="grid gap-4"
          variants={listContainerVariants}
          initial="initial"
          animate="animate"
        >
          <AnimatePresence mode="popLayout">
            {filteredTasks.map((task, index) => (
              <AnimatedTaskCard key={task.id} task={task} index={index} />
            ))}
          </AnimatePresence>
        </m.div>
      )}
    </div>
  );
}
