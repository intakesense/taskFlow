'use client'

import { useState } from 'react'
import {
  DndContext,
  DragOverlay,
  closestCorners,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
} from '@dnd-kit/core'
import { Plus, Search, X, ClipboardList, UserCheck, PenLine, Users2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { useMediaQuery } from '@/hooks/use-media-query'
import { KANBAN_COLUMNS } from '@/lib/constants/task'
import { KanbanColumn } from './kanban-column'
import { KanbanCardOverlay } from './kanban-card'
import { KanbanMobile } from './kanban-mobile'
import { CreateTaskDrawer } from '../create-task-drawer'
import { ProgressFeedSheet } from '../progress-feed-sheet'
import type { TaskWithUsers, TaskStatus } from '@/lib/types'
import type { FilterType } from '../tasks-view-social'

interface KanbanViewProps {
  tasks: TaskWithUsers[]
  isLoading: boolean
  searchQuery: string
  typeFilter: FilterType
  currentUserId?: string
  onSearchChange: (query: string) => void
  onTypeFilterChange: (type: FilterType) => void
  onStatusChange: (taskId: string, status: string) => void
  onDelete?: (taskId: string) => void
}

const TYPE_OPTIONS: { value: FilterType; icon: typeof ClipboardList; label: string; short: string }[] = [
  { value: 'all', icon: ClipboardList, label: 'All Tasks', short: 'All' },
  { value: 'created', icon: PenLine, label: 'Created', short: 'Created' },
  { value: 'assigned', icon: UserCheck, label: 'Assigned', short: 'Assigned' },
  { value: 'team', icon: Users2, label: 'Team', short: 'Team' },
]

export function KanbanView({
  tasks,
  isLoading,
  searchQuery,
  typeFilter,
  currentUserId,
  onSearchChange,
  onTypeFilterChange,
  onStatusChange,
  onDelete,
}: KanbanViewProps) {
  const [showCreateDrawer, setShowCreateDrawer] = useState(false)
  const [activeTask, setActiveTask] = useState<TaskWithUsers | null>(null)
  const [overId, setOverId] = useState<string | null>(null)
  const [mobileStatus, setMobileStatus] = useState<TaskStatus>('pending')

  const isDesktop = useMediaQuery('(min-width: 768px)')

  // Configure sensors for desktop drag-drop only
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  )

  // Group tasks by status
  const tasksByStatus = KANBAN_COLUMNS.reduce(
    (acc, status) => {
      acc[status] = tasks.filter(t => t.status === status)
      return acc
    },
    {} as Record<TaskStatus, TaskWithUsers[]>
  )

  const handleDragStart = (event: DragStartEvent) => {
    const task = tasks.find(t => t.id === event.active.id)
    if (task) setActiveTask(task)
  }

  const handleDragOver = (event: DragOverEvent) => {
    setOverId(event.over?.id as string | null)
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    setActiveTask(null)
    setOverId(null)

    if (!over) return

    const taskId = active.id as string
    const task = tasks.find(t => t.id === taskId)
    if (!task) return

    let targetStatus: TaskStatus | null = null

    if (KANBAN_COLUMNS.includes(over.id as TaskStatus)) {
      targetStatus = over.id as TaskStatus
    } else {
      const targetTask = tasks.find(t => t.id === over.id)
      if (targetTask) {
        targetStatus = targetTask.status as TaskStatus
      }
    }

    if (targetStatus && targetStatus !== task.status) {
      onStatusChange(taskId, targetStatus)
    }
  }

  const handleDragCancel = () => {
    setActiveTask(null)
    setOverId(null)
  }

  const handleDelete = (taskId: string) => {
    if (onDelete) onDelete(taskId)
  }

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Sticky header */}
      <div className="flex-shrink-0 px-4 pt-4 pb-3 border-b bg-card sticky top-0 z-10 space-y-3">
        {/* Row 1: Title + Action buttons */}
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold">Tasks</h1>
          <div className="flex items-center gap-2">
            <ProgressFeedSheet />
            <Button
              size="icon"
              onClick={() => setShowCreateDrawer(true)}
              className="h-9 w-9 rounded-full"
            >
              <Plus className="h-5 w-5" />
            </Button>
          </div>
        </div>

        {/* Row 2: Segmented control */}
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

        {/* Row 3: Search */}
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

      {/* Content: Desktop Kanban or Mobile Tabbed */}
      {isLoading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : isDesktop ? (
        <div className="flex-1 overflow-x-auto overflow-y-hidden">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCorners}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
            onDragCancel={handleDragCancel}
          >
            <div className="flex gap-4 p-4 h-full min-w-max">
              {KANBAN_COLUMNS.map(status => (
                <KanbanColumn
                  key={status}
                  status={status}
                  tasks={tasksByStatus[status]}
                  isOver={overId === status}
                />
              ))}
            </div>

            <DragOverlay>
              {activeTask && <KanbanCardOverlay task={activeTask} />}
            </DragOverlay>
          </DndContext>
        </div>
      ) : (
        <KanbanMobile
          tasks={tasks}
          selectedStatus={mobileStatus}
          onStatusSelect={setMobileStatus}
          onStatusChange={onStatusChange}
          onDelete={handleDelete}
          currentUserId={currentUserId}
        />
      )}

      <CreateTaskDrawer open={showCreateDrawer} onOpenChange={setShowCreateDrawer} />
    </div>
  )
}
