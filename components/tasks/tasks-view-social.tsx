'use client'

import { useState } from 'react'
import { Plus, Search, X, ClipboardList, UserCheck, PenLine } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { SwipeableTaskCard } from './swipeable-task-card'
import { CreateTaskDrawer } from './create-task-drawer'
import type { TaskWithUsers, TaskStatus as TaskStatusType } from '@/lib/types'

type FilterType = 'all' | 'assigned' | 'created'

interface TasksViewSocialProps {
  tasks: TaskWithUsers[]
  isLoading: boolean
  searchQuery: string
  statusFilter: TaskStatusType | 'all'
  typeFilter: FilterType
  onSearchChange: (query: string) => void
  onStatusFilterChange: (status: TaskStatusType | 'all') => void
  onTypeFilterChange: (type: FilterType) => void
  onStatusChange?: (taskId: string, status: string) => void
  onDelete?: (taskId: string) => void
  currentUserId?: string
}

// ── Primary view config (segmented control) ─────────────────────────
const TYPE_OPTIONS: { value: FilterType; icon: typeof ClipboardList; label: string; short: string }[] = [
  { value: 'all', icon: ClipboardList, label: 'All Tasks', short: 'All' },
  { value: 'assigned', icon: UserCheck, label: 'Assigned', short: 'Assigned' },
  { value: 'created', icon: PenLine, label: 'Created', short: 'Created' },
]

// ── Status chip config ───────────────────────────────────────────────
const STATUS_OPTIONS: { value: TaskStatusType | 'all'; label: string; dot?: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'pending', label: 'Pending', dot: 'bg-amber-500' },
  { value: 'in_progress', label: 'In Progress', dot: 'bg-blue-500' },
  { value: 'archived', label: 'Done', dot: 'bg-emerald-500' },
]

export function TasksViewSocial({
  tasks,
  isLoading,
  searchQuery,
  statusFilter,
  typeFilter,
  onSearchChange,
  onStatusFilterChange,
  onTypeFilterChange,
  onStatusChange,
  onDelete,
  currentUserId,
}: TasksViewSocialProps) {
  const [showCreateDrawer, setShowCreateDrawer] = useState(false)

  return (
    <div className="flex flex-col min-h-screen bg-background">
      {/* ── Sticky header ────────────────────────────────────────── */}
      <div className="flex-shrink-0 px-4 pt-4 pb-3 border-b bg-card sticky top-0 z-10 space-y-3">

        {/* Row 1: Title + New button */}
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold">Tasks</h1>
          <Button
            size="icon"
            onClick={() => setShowCreateDrawer(true)}
            className="h-9 w-9 rounded-full"
          >
            <Plus className="h-5 w-5" />
          </Button>
        </div>

        {/* Row 2: Segmented control — primary view switcher */}
        <div className="grid grid-cols-3 gap-1 rounded-lg bg-muted p-1">
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

        {/* Row 3: Search + status chips */}
        <div className="flex gap-2">
          {/* Search */}
          <div className="relative flex-1">
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

          {/* Status chips — horizontal scroll */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar flex-shrink-0 max-w-[55%]">
            {STATUS_OPTIONS.map(({ value, label, dot }) => (
              <button
                key={value}
                onClick={() => onStatusFilterChange(value)}
                className={cn(
                  'flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-medium whitespace-nowrap border transition-all',
                  statusFilter === value
                    ? 'bg-foreground/10 border-foreground/20 text-foreground'
                    : 'bg-transparent border-border text-muted-foreground hover:text-foreground hover:border-foreground/20'
                )}
              >
                {dot && <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', dot)} />}
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Task feed ────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : tasks.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">📋</div>
            <h3 className="text-lg font-semibold mb-2">No tasks yet</h3>
            <p className="text-sm text-muted-foreground mb-4">
              {searchQuery
                ? 'No tasks match your search'
                : 'Create your first task to get started'}
            </p>
            <Button
              onClick={() => setShowCreateDrawer(true)}
              className="rounded-full"
            >
              <Plus className="h-4 w-4 mr-2" />
              Create Task
            </Button>
          </div>
        ) : (
          tasks.map((task) => (
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

      {/* Create Task Drawer */}
      <CreateTaskDrawer open={showCreateDrawer} onOpenChange={setShowCreateDrawer} />
    </div>
  )
}
