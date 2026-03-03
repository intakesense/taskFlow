'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { MoreVertical, CheckCircle2, Clock, Timer, PauseCircle, Users } from 'lucide-react'
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
import { formatCompactDuration, getDurationMs, DURATION_THRESHOLDS } from '@/lib/utils/date'
import type { TaskWithUsers, TaskStatus } from '@/lib/types'

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

  // Get status-specific time info
  const getStatusTimeInfo = () => {
    const status = task.status as TaskStatus
    switch (status) {
      case 'pending':
        return { timestamp: task.created_at, icon: Clock }
      case 'in_progress':
        return {
          timestamp: task.started_at,
          icon: Timer,
          isWarning: task.started_at && getDurationMs(task.started_at) > DURATION_THRESHOLDS.IN_PROGRESS_WARNING,
        }
      case 'on_hold':
        return {
          timestamp: task.on_hold_at,
          icon: PauseCircle,
          isWarning: task.on_hold_at && getDurationMs(task.on_hold_at) > DURATION_THRESHOLDS.ON_HOLD_WARNING,
        }
      case 'archived':
        return { timestamp: task.archived_at, icon: CheckCircle2 }
      default:
        return null
    }
  }

  const timeInfo = getStatusTimeInfo()
  const formattedTime = timeInfo?.timestamp ? formatCompactDuration(timeInfo.timestamp) : ''
  const TimeIcon = timeInfo?.icon || Clock

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

              {/* Status Time */}
              {formattedTime && (
                <div
                  className={cn(
                    'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs',
                    timeInfo?.isWarning
                      ? 'bg-amber-500/10 text-amber-500'
                      : 'bg-muted text-muted-foreground'
                  )}
                >
                  <TimeIcon className="h-3 w-3" />
                  {formattedTime}
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
              {/* Edit assignees - only creator */}
              {isCreatedByMe && task.status !== 'archived' && (
                <DropdownMenuItem asChild>
                  <Link href={`/tasks/${task.id}`} className="cursor-pointer">
                    <Users className="h-4 w-4 mr-2" />
                    Edit Assignees
                  </Link>
                </DropdownMenuItem>
              )}
              {/* Status changes - assignee can start/pause/resume */}
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
                    <DropdownMenuItem
                      onClick={() => onStatusChange(task.id, 'on_hold')}
                    >
                      Put On Hold
                    </DropdownMenuItem>
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
              {/* Creator can mark complete or reopen */}
              {onStatusChange && isCreatedByMe && task.status === 'in_progress' && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => onStatusChange(task.id, 'archived')}
                  >
                    Mark Complete
                  </DropdownMenuItem>
                </>
              )}
              {onStatusChange && isCreatedByMe && task.status === 'archived' && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => onStatusChange(task.id, 'in_progress')}
                  >
                    Reopen Task
                  </DropdownMenuItem>
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

      {/* Action Bar - Creator can complete in_progress tasks or reopen completed tasks */}
      {isCreatedByMe && task.status === 'in_progress' && (
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
      {isCreatedByMe && task.status === 'archived' && (
        <div className="px-4 pb-3 pt-1 border-t flex items-center">
          <button
            onClick={(e) => {
              e.stopPropagation()
              onStatusChange?.(task.id, 'in_progress')
            }}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-blue-500 transition-colors"
          >
            <Clock className="h-4 w-4" />
            <span>Reopen Task</span>
          </button>
        </div>
      )}
    </div>
  )
}
