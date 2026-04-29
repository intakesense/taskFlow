'use client';

import { useState, useMemo } from 'react';
import { toast } from 'sonner';
import type { TaskStatus, TaskPriority, TaskWithUsers, User } from '@taskflow/core';
import { useAuth } from '../../providers/auth-context';
import { useTasks, useChangeTaskStatus, useDeleteTask, useAssignableUsers } from '../../hooks';
import { KanbanView } from './kanban';
import { TeamView } from './team-view';
import { TasksViewSocial } from './tasks-view-social';
import { ErrorBoundary } from '../error-boundary';
import type { FilterType } from './types';

interface TasksContainerProps {
  /** Render function for create task UI (drawer/dialog) */
  renderCreateTask?: (props: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    initialSelectedUserIds?: string[];
  }) => React.ReactNode;
  /** Render function for progress feed (sheet/panel) */
  renderProgressFeed?: () => React.ReactNode;
}

export function TasksContainer({ renderCreateTask, renderProgressFeed }: TasksContainerProps) {
  const { effectiveUser } = useAuth();
  const { data: tasks = [], isLoading } = useTasks();
  const { data: assignableUsers = [], isLoading: isLoadingUsers } = useAssignableUsers(
    effectiveUser?.level
  );
  const changeTaskStatus = useChangeTaskStatus();
  const deleteTask = useDeleteTask();

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<TaskStatus | 'all'>('all');
  const [priorityFilter, setPriorityFilter] = useState<TaskPriority | 'all'>('all');
  const [typeFilter, setTypeFilter] = useState<FilterType>('all');
  const [showCreateDrawer, setShowCreateDrawer] = useState(false);
  const [preselectedUserId, setPreselectedUserId] = useState<string | undefined>();

  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        if (
          !task.title.toLowerCase().includes(query) &&
          !task.description?.toLowerCase().includes(query)
        ) {
          return false;
        }
      }

      if (statusFilter !== 'all' && task.status !== statusFilter) {
        return false;
      }

      if (priorityFilter !== 'all' && task.priority !== priorityFilter) {
        return false;
      }

      if (typeFilter === 'assigned' && !task.assignees?.some((a) => a.id === effectiveUser?.id)) {
        return false;
      }
      if (typeFilter === 'created' && task.assigned_by !== effectiveUser?.id) {
        return false;
      }

      return true;
    });
  }, [tasks, searchQuery, statusFilter, priorityFilter, typeFilter, effectiveUser?.id]);

  const handleStatusChange = async (taskId: string, status: string, onHoldReason?: string) => {
    await changeTaskStatus.mutateAsync({
      taskId,
      status: status as TaskStatus,
      onHoldReason,
    });
  };

  const handleDelete = async (taskId: string) => {
    if (!confirm('Are you sure you want to delete this task?')) return;

    try {
      await deleteTask.mutateAsync(taskId);
      toast.success('Task deleted');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to delete task';
      toast.error(message);
    }
  };

  const tasksByAssignee = useMemo(() => {
    const map = new Map<string, TaskWithUsers[]>();
    for (const task of tasks) {
      if (task.status === 'archived') continue;
      for (const assignee of task.assignees || []) {
        const existing = map.get(assignee.id) || [];
        existing.push(task);
        map.set(assignee.id, existing);
      }
    }
    return map;
  }, [tasks]);

  const kanbanTasks = useMemo(() => {
    return tasks.filter((task) => {
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        if (
          !task.title.toLowerCase().includes(query) &&
          !task.description?.toLowerCase().includes(query)
        ) {
          return false;
        }
      }
      if (priorityFilter !== 'all' && task.priority !== priorityFilter) {
        return false;
      }
      return true;
    });
  }, [tasks, searchQuery, priorityFilter]);

  const handleCreateTask = (userId?: string) => {
    setPreselectedUserId(userId);
    setShowCreateDrawer(true);
  };

  const handleDrawerClose = (open: boolean) => {
    setShowCreateDrawer(open);
    if (!open) setPreselectedUserId(undefined);
  };

  const renderView = () => {
    switch (typeFilter) {
      case 'all':
        return (
          <KanbanView
            tasks={kanbanTasks}
            isLoading={isLoading}
            searchQuery={searchQuery}
            typeFilter={typeFilter}
            priorityFilter={priorityFilter}
            currentUserId={effectiveUser?.id}
            onSearchChange={setSearchQuery}
            onTypeFilterChange={setTypeFilter}
            onPriorityFilterChange={setPriorityFilter}
            onStatusChange={handleStatusChange}
            onDelete={handleDelete}
            onCreateTask={() => handleCreateTask()}
            renderProgressFeed={renderProgressFeed}
          />
        );
      case 'team':
        return (
          <TeamView
            users={assignableUsers as User[]}
            tasksByAssignee={tasksByAssignee}
            isLoading={isLoading || isLoadingUsers}
            searchQuery={searchQuery}
            statusFilter={statusFilter}
            typeFilter={typeFilter}
            onSearchChange={setSearchQuery}
            onStatusFilterChange={setStatusFilter}
            onTypeFilterChange={setTypeFilter}
            currentUserId={effectiveUser?.id}
            onCreateTask={handleCreateTask}
            renderProgressFeed={renderProgressFeed}
          />
        );
      default:
        return (
          <TasksViewSocial
            tasks={filteredTasks}
            isLoading={isLoading}
            searchQuery={searchQuery}
            statusFilter={statusFilter}
            priorityFilter={priorityFilter}
            typeFilter={typeFilter}
            onSearchChange={setSearchQuery}
            onStatusFilterChange={setStatusFilter}
            onPriorityFilterChange={setPriorityFilter}
            onTypeFilterChange={setTypeFilter}
            onStatusChange={handleStatusChange}
            onDelete={handleDelete}
            currentUserId={effectiveUser?.id}
            onCreateTask={() => handleCreateTask()}
            renderProgressFeed={renderProgressFeed}
          />
        );
    }
  };

  return (
    <>
      <ErrorBoundary label="tasks view">
        {renderView()}
      </ErrorBoundary>
      {renderCreateTask?.({
        open: showCreateDrawer,
        onOpenChange: handleDrawerClose,
        initialSelectedUserIds: preselectedUserId ? [preselectedUserId] : undefined,
      })}
    </>
  );
}
