'use client'

import { useState } from 'react'
import Link from 'next/link'
import { MoreVertical, MessageCircle, CheckCircle2, Clock, Calendar } from 'lucide-react'
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
import { formatRelative, formatMessageTime } from '@/lib/utils/date'
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
  const [isExpanded] = useState(false)

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

  return (
    <div
      className={cn(
        'bg-card rounded-2xl border transition-all',
        'hover:shadow-md active:scale-[0.98]',
        isAssignedToMe && 'border-primary/20 bg-primary/5'
      )}
    >
      {/* Header */}
      <div className="px-4 pt-4 pb-3">
        <div className="flex items-start gap-3">
          {/* Stacked Avatars */}
          <Link href={`/tasks/${task.id}`}>
            <div className="cursor-pointer">
              {task.assignees && task.assignees.length > 0 ? (
                <StackedAvatars users={task.assignees} max={3} size="lg" />
              ) : (
                <StackedAvatars users={task.assigner ? [task.assigner] : []} max={1} size="lg" />
              )}
            </div>
          </Link>

          {/* Content */}
          <div className="flex-1 min-w-0">
            {/* Name and Time */}
            <div className="flex items-center gap-2 mb-1">
              <span className="font-semibold text-sm truncate">
                {assigneeDisplay}
              </span>
              <span className="text-xs text-muted-foreground flex-shrink-0">
                {formatMessageTime(task.created_at)}
              </span>
            </div>

            {/* Relationship */}
            <div className="text-xs text-muted-foreground mb-2">
              {isAssignedToMe ? (
                <span>Assigned by {task.assigner?.name}</span>
              ) : isCreatedByMe ? (
                <span>
                  You assigned to {assigneeNames.length > 0
                    ? assigneeNames.length === 1
                      ? assigneeNames[0]
                      : `${assigneeNames.length} people`
                    : 'someone'}
                </span>
              ) : (
                <span>From {task.assigner?.name}</span>
              )}
            </div>

            {/* Title */}
            <Link href={`/tasks/${task.id}`}>
              <h3 className="font-semibold text-base mb-2 cursor-pointer hover:underline">
                {task.title}
              </h3>
            </Link>

            {/* Description Preview */}
            {task.description && (
              <div
                className={cn(
                  'text-sm text-muted-foreground mb-3',
                  !isExpanded && 'line-clamp-2'
                )}
              >
                {task.description}
              </div>
            )}

            {/* Meta Pills */}
            <div className="flex flex-wrap gap-2 mb-3">
              {/* Priority */}
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-muted text-xs">
                <span className={cn('w-2 h-2 rounded-full', getPriorityColor(task.priority))} />
                <span className="capitalize">{task.priority}</span>
              </div>

              {/* Status */}
              <div
                className={cn(
                  'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-muted text-xs',
                  statusInfo.color
                )}
              >
                <StatusIcon className="h-3 w-3" />
                {statusInfo.label}
              </div>

              {/* Deadline */}
              {task.deadline && (
                <div
                  className={cn(
                    'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs',
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

      {/* Action Bar */}
      <div className="px-4 pb-3 pt-1 border-t flex items-center gap-4">
        <Link
          href={`/tasks/${task.id}`}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <MessageCircle className="h-4 w-4" />
          <span>Comment</span>
        </Link>

        {isAssignedToMe && task.status !== 'archived' && (
          <button
            onClick={() => onStatusChange?.(task.id, 'archived')}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-green-500 transition-colors"
          >
            <CheckCircle2 className="h-4 w-4" />
            <span>Complete</span>
          </button>
        )}
      </div>
    </div>
  )
}
