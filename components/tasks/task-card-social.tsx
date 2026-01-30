'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { MoreVertical, CheckCircle2, Clock, Calendar } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { StackedAvatars } from './stacked-avatars'
import { cn } from '@/lib/utils'
import { formatRelative } from '@/lib/utils/date'
import type { TaskWithUsers } from '@/lib/types'

interface TaskCardSocialProps {
  task: TaskWithUsers
  onStatusChange?: (taskId: string, status: string) => void
  onDelete?: (taskId: string) => void
  currentUserId?: string
}

export function TaskCardSocial({
  task,
  onStatusChange,
  onDelete,
  currentUserId,
}: TaskCardSocialProps) {
  const router = useRouter()

  const isAssignedToMe = task.assignees?.some(a => a.id === currentUserId) || false
  const isCreatedByMe = currentUserId === task.assigned_by

  const getPriorityColor = (priority: string) => {
    const colors = {
      low: 'bg-blue-500',
      medium: 'bg-yellow-500',
      high: 'bg-orange-500',
      urgent: 'bg-red-500',
    }
    return colors[priority as keyof typeof colors] || 'bg-gray-500'
  }

  const getStatusInfo = (status: string) => {
    const info = {
      pending: { label: 'Not Started', color: 'text-muted-foreground', icon: Clock },
      in_progress: { label: 'In Progress', color: 'text-blue-500', icon: Clock },
      on_hold: { label: 'On Hold', color: 'text-yellow-500', icon: Clock },
      archived: { label: 'Completed', color: 'text-green-500', icon: CheckCircle2 },
    }
    return info[status as keyof typeof info] || info.pending
  }

  const statusInfo = getStatusInfo(task.status)
  const StatusIcon = statusInfo.icon

  const isOverdue =
    task.deadline && new Date(task.deadline) < new Date() && task.status !== 'archived'

  // Get assignee names for display
  const assigneeNames = task.assignees?.map(a => a.name) || []
  const assigneeDisplay = assigneeNames.length === 0
    ? 'Unassigned'
    : assigneeNames.length === 1
    ? assigneeNames[0]
    : `${assigneeNames[0]} +${assigneeNames.length - 1}`

  // Handle card click - navigate to task detail
  const handleCardClick = (e: React.MouseEvent) => {
    // Don't navigate if clicking on interactive elements
    const target = e.target as HTMLElement
    if (target.closest('button') || target.closest('[role="menuitem"]') || target.closest('a')) {
      return
    }
    router.push(`/tasks/${task.id}`)
  }

  return (
    <div
      onClick={handleCardClick}
      className={cn(
        'bg-card rounded-2xl border transition-all cursor-pointer',
        'hover:shadow-md active:scale-[0.99]',
        isAssignedToMe && 'border-primary/20 bg-primary/5'
      )}
    >
      {/* Main Content */}
      <div className="px-4 pt-4 pb-3">
        <div className="flex items-start gap-3">
          {/* Stacked Avatars */}
          <div className="flex-shrink-0 pt-0.5">
            {task.assignees && task.assignees.length > 0 ? (
              <StackedAvatars users={task.assignees} max={3} size="md" />
            ) : (
              <StackedAvatars users={task.assigner ? [task.assigner] : []} max={1} size="md" />
            )}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            {/* Task Title - Primary info, shown first */}
            <h3 className="font-semibold text-base mb-1 line-clamp-2">
              {task.title}
            </h3>

            {/* Assignee info - Secondary */}
            <div className="flex items-center gap-2 mb-2 text-sm text-muted-foreground">
              <span className="truncate">
                {isAssignedToMe ? (
                  <>From {task.assigner?.name}</>
                ) : isCreatedByMe ? (
                  <>To {assigneeDisplay}</>
                ) : (
                  <>{assigneeDisplay}</>
                )}
              </span>
            </div>

            {/* Description Preview */}
            {task.description && (
              <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                {task.description}
              </p>
            )}

            {/* Meta Pills */}
            <div className="flex flex-wrap items-center gap-2">
              {/* Status */}
              <div
                className={cn(
                  'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-muted text-xs',
                  statusInfo.color
                )}
              >
                <StatusIcon className="h-3 w-3" />
                {statusInfo.label}
              </div>

              {/* Priority */}
              <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-muted text-xs">
                <span className={cn('w-1.5 h-1.5 rounded-full', getPriorityColor(task.priority))} />
                <span className="capitalize">{task.priority}</span>
              </div>

              {/* Deadline */}
              {task.deadline && (
                <div
                  className={cn(
                    'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs',
                    isOverdue
                      ? 'bg-red-500/10 text-red-500'
                      : 'bg-muted text-muted-foreground'
                  )}
                >
                  <Calendar className="h-3 w-3" />
                  {formatRelative(task.deadline)}
                </div>
              )}
            </div>
          </div>

          {/* More Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-full flex-shrink-0"
                onClick={(e) => e.stopPropagation()}
              >
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem asChild>
                <Link href={`/tasks/${task.id}`} className="cursor-pointer">
                  View Details
                </Link>
              </DropdownMenuItem>
              {/* Status changes - only assignee can start/pause/complete */}
              {onStatusChange && isAssignedToMe && task.status !== 'archived' && (
                <>
                  <DropdownMenuSeparator />
                  {task.status === 'pending' && (
                    <DropdownMenuItem
                      onClick={() => onStatusChange(task.id, 'in_progress')}
                    >
                      Start Task
                    </DropdownMenuItem>
                  )}
                  {task.status === 'in_progress' && (
                    <>
                      <DropdownMenuItem
                        onClick={() => onStatusChange(task.id, 'on_hold')}
                      >
                        Put On Hold
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => onStatusChange(task.id, 'archived')}
                      >
                        Mark Complete
                      </DropdownMenuItem>
                    </>
                  )}
                  {task.status === 'on_hold' && (
                    <DropdownMenuItem
                      onClick={() => onStatusChange(task.id, 'in_progress')}
                    >
                      Resume Task
                    </DropdownMenuItem>
                  )}
                </>
              )}
              {/* Delete - only assigner can delete */}
              {onDelete && isCreatedByMe && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => onDelete(task.id)}
                    className="text-destructive"
                  >
                    Delete Task
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Action Bar - Only show if user can complete */}
      {isAssignedToMe && task.status !== 'archived' && (
        <div className="px-4 pb-3 pt-1 border-t flex items-center">
          <button
            onClick={(e) => {
              e.stopPropagation()
              onStatusChange?.(task.id, 'archived')
            }}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-green-500 transition-colors"
          >
            <CheckCircle2 className="h-4 w-4" />
            <span>Mark Complete</span>
          </button>
        </div>
      )}
    </div>
  )
}
