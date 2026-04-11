'use client';

import { useState, useMemo, useCallback } from 'react';
import { toast } from 'sonner';
import { useAuth } from '../../providers/auth-context';
import { useTasks, useChangeTaskStatus, useDeleteTask, useAssignableUsers } from '../../hooks';
import { TasksViewSocial } from './tasks-view-social';
import { TeamView } from './team-view';
import { KanbanView } from './kanban';
import { OnHoldDialog } from './on-hold-dialog';
import { CreateTaskDrawer } from './create-task-drawer';
import { ProgressFeedSheet } from '../progress/progress-feed-sheet';
import type { TaskStatus, TaskWithUsers } from '@taskflow/core';
import type { FilterType } from './types';

interface TasksContainerSocialProps {
  initialTasks?: TaskWithUsers[];
}

export function TasksContainerSocial({ initialTasks }: TasksContainerSocialProps) {
  const { effectiveUser } = useAuth();
  const { data: tasks = [], isLoading } = useTasks({ initialData: initialTasks });
  const { data: assignableUsers = [], isLoading: isLoadingUsers } = useAssignableUsers(
    effectiveUser?.level
  );
  const changeStatus = useChangeTaskStatus();
  const deleteTask = useDeleteTask();

  // Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<TaskStatus | 'all'>('all');
  const [typeFilter, setTypeFilter] = useState<FilterType>('all');
  const [showCreateDrawer, setShowCreateDrawer] = useState(false);

  // On-hold dialog state
  const [onHoldDialog, setOnHoldDialog] = useState<{
    open: boolean;
    taskId: string | null;
    taskTitle: string | null;
  }>({ open: false, taskId: null, taskTitle: null });

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
      if (
        typeFilter === 'assigned' &&
        !task.assignees?.some((a) => a.id === effectiveUser?.id)
      ) {
        return false;
      }
      if (typeFilter === 'created' && task.assigned_by !== effectiveUser?.id) {
        return false;
      }

      return true;
    });
  }, [tasks, searchQuery, statusFilter, typeFilter, effectiveUser?.id]);

  // Handle on_hold confirmation with reason
  const handleOnHoldConfirm = useCallback(async (reason: string) => {
    if (!onHoldDialog.taskId) return;

    try {
      await changeStatus.mutateAsync({
        taskId: onHoldDialog.taskId,
        status: 'on_hold',
        onHoldReason: reason,
      });
      toast.success('Task put on hold');
    } catch {
      // Error is handled by the hook
    } finally {
      setOnHoldDialog({ open: false, taskId: null, taskTitle: null });
    }
  }, [onHoldDialog.taskId, changeStatus]);

  const handleStatusChange = useCallback(async (taskId: string, status: string, onHoldReason?: string) => {
    const typedStatus = status as TaskStatus;

    // on_hold requires a reason. If one wasn't provided (e.g. from a non-kanban
    // source like the list view), show the dialog to collect it.
    if (typedStatus === 'on_hold' && !onHoldReason) {
      const task = tasks.find((t) => t.id === taskId);
      setOnHoldDialog({
        open: true,
        taskId,
        taskTitle: task?.title || null,
      });
      return;
    }

    try {
      await changeStatus.mutateAsync({
        taskId,
        status: typedStatus,
        onHoldReason,
      });
      toast.success('Task updated');
    } catch {
      // Error is handled by the hook (shows toast with user-friendly message)
    }
  }, [tasks, changeStatus]);

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

  // Group tasks by assignee for team view
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

  // Filter tasks for kanban (search only, no status filter - columns handle that)
  const kanbanTasks = useMemo(() => {
    if (!searchQuery) return tasks;
    const query = searchQuery.toLowerCase();
    return tasks.filter(
      (task) =>
        task.title.toLowerCase().includes(query) ||
        task.description?.toLowerCase().includes(query)
    );
  }, [tasks, searchQuery]);

  const renderView = () => {
    switch (typeFilter) {
      case 'all':
        return (
          <KanbanView
            tasks={kanbanTasks}
            isLoading={isLoading}
            searchQuery={searchQuery}
            typeFilter={typeFilter}
            currentUserId={effectiveUser?.id}
            onSearchChange={setSearchQuery}
            onTypeFilterChange={setTypeFilter}
            onStatusChange={handleStatusChange}
            onDelete={handleDelete}
            onCreateTask={() => setShowCreateDrawer(true)}
            renderProgressFeed={() => <ProgressFeedSheet />}
          />
        );
      case 'team':
        return (
          <TeamView
            users={assignableUsers}
            tasksByAssignee={tasksByAssignee}
            isLoading={isLoading || isLoadingUsers}
            searchQuery={searchQuery}
            statusFilter={statusFilter}
            typeFilter={typeFilter}
            onSearchChange={setSearchQuery}
            onStatusFilterChange={setStatusFilter}
            onTypeFilterChange={setTypeFilter}
            currentUserId={effectiveUser?.id}
          />
        );
      default:
        return (
          <TasksViewSocial
            tasks={filteredTasks}
            isLoading={isLoading}
            searchQuery={searchQuery}
            statusFilter={statusFilter}
            typeFilter={typeFilter}
            onSearchChange={setSearchQuery}
            onStatusFilterChange={setStatusFilter}
            onTypeFilterChange={setTypeFilter}
            onStatusChange={handleStatusChange}
            onDelete={handleDelete}
            currentUserId={effectiveUser?.id}
          />
        );
    }
  };

  return (
    <>
      {renderView()}
      <CreateTaskDrawer open={showCreateDrawer} onOpenChange={setShowCreateDrawer} />
      <OnHoldDialog
        open={onHoldDialog.open}
        onOpenChange={(open) => {
          if (!open) {
            setOnHoldDialog({ open: false, taskId: null, taskTitle: null });
          }
        }}
        onConfirm={handleOnHoldConfirm}
        taskTitle={onHoldDialog.taskTitle || undefined}
      />
    </>
  );
}
