'use client'

import { useState, useMemo } from 'react'
import { useAuth } from '@/lib/auth-context'
import { useTasks, useUpdateTask, useDeleteTask } from '@/hooks'
import { useAssignableUsers } from '@/hooks/use-users'
import { TasksViewSocial, type FilterType } from './tasks-view-social'
import { TeamView } from './team-view'
import { KanbanView } from './kanban'
import { DashboardLayout } from '@/components/layout'
import { toast } from 'sonner'
import type { TaskStatus, TaskWithUsers } from '@/lib/types'

interface TasksContainerSocialProps {
  initialTasks?: TaskWithUsers[]
}

export function TasksContainerSocial({ initialTasks }: TasksContainerSocialProps) {
  const { effectiveUser } = useAuth()
  const { data: tasks = [], isLoading } = useTasks({ initialData: initialTasks })
  const { data: assignableUsers = [], isLoading: isLoadingUsers } = useAssignableUsers(effectiveUser?.level)
  const updateTask = useUpdateTask()
  const deleteTask = useDeleteTask()

  // Filter state
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<TaskStatus | 'all'>('all')
  const [typeFilter, setTypeFilter] = useState<FilterType>('all')

  // Filter tasks
  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase()
        if (
          !task.title.toLowerCase().includes(query) &&
          !task.description?.toLowerCase().includes(query)
        ) {
          return false
        }
      }

      // Status filter
      if (statusFilter !== 'all' && task.status !== statusFilter) {
        return false
      }

      // Type filter
      if (typeFilter === 'assigned' && !task.assignees?.some(a => a.id === effectiveUser?.id)) {
        return false
      }
      if (typeFilter === 'created' && task.assigned_by !== effectiveUser?.id) {
        return false
      }

      return true
    })
  }, [tasks, searchQuery, statusFilter, typeFilter, effectiveUser?.id])

  const handleStatusChange = async (taskId: string, status: string) => {
    try {
      await updateTask.mutateAsync({
        id: taskId,
        input: { status: status as 'pending' | 'in_progress' | 'on_hold' | 'archived' },
      })
      toast.success('Task updated')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update task'
      toast.error(message)
    }
  }

  const handleDelete = async (taskId: string) => {
    if (!confirm('Are you sure you want to delete this task?')) return

    try {
      await deleteTask.mutateAsync(taskId)
      toast.success('Task deleted')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to delete task'
      toast.error(message)
    }
  }

  // Group tasks by assignee for team view
  const tasksByAssignee = useMemo(() => {
    const map = new Map<string, TaskWithUsers[]>()
    for (const task of tasks) {
      if (task.status === 'archived') continue
      for (const assignee of task.assignees || []) {
        const existing = map.get(assignee.id) || []
        existing.push(task)
        map.set(assignee.id, existing)
      }
    }
    return map
  }, [tasks])

  // Filter tasks for kanban (search only, no status filter - columns handle that)
  const kanbanTasks = useMemo(() => {
    if (!searchQuery) return tasks
    const query = searchQuery.toLowerCase()
    return tasks.filter(
      task =>
        task.title.toLowerCase().includes(query) ||
        task.description?.toLowerCase().includes(query)
    )
  }, [tasks, searchQuery])

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
          />
        )
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
        )
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
        )
    }
  }

  return <DashboardLayout>{renderView()}</DashboardLayout>
}
