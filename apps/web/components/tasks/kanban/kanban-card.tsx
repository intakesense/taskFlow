'use client'

import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useRouter } from 'next/navigation'
import { Clock, GripVertical, Timer, PauseCircle, CheckCircle2 } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'
import { formatCompactDuration, getDurationMs, DURATION_THRESHOLDS } from '@/lib/utils/date'
import { TASK_PRIORITY_CONFIG } from '@/lib/constants/task'
import type { TaskWithUsers, TaskPriority, TaskStatus } from '@/lib/types'

interface KanbanCardProps {
  task: TaskWithUsers
  isDragging?: boolean
  isOverlay?: boolean
}

function getInitials(name: string) {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
}

export function KanbanCard({ task, isDragging, isOverlay }: KanbanCardProps) {
  const router = useRouter()
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging: isSortableDragging,
  } = useSortable({ id: task.id })

  // Smooth transform with spring-like easing
  const style = {
    transform: CSS.Transform.toString(transform),
    transition: transition || 'transform 200ms cubic-bezier(0.25, 1, 0.5, 1)',
    // Make the original card semi-transparent when being dragged
    opacity: isSortableDragging ? 0.4 : 1,
    // Slight scale down when being dragged from original position
    scale: isSortableDragging ? 0.98 : 1,
  }

  const priorityConfig = TASK_PRIORITY_CONFIG[task.priority as TaskPriority]
  const primaryAssignee = task.assignees?.[0]
  const additionalCount = (task.assignees?.length || 0) - 1

  // Get status-specific time info
  const getStatusTimeInfo = () => {
    const status = task.status as TaskStatus
    switch (status) {
      case 'pending':
        return {
          timestamp: task.created_at,
          icon: Clock,
          label: 'Created',
        }
      case 'in_progress':
        return {
          timestamp: task.started_at,
          icon: Timer,
          label: 'Started',
          isWarning: task.started_at && getDurationMs(task.started_at) > DURATION_THRESHOLDS.IN_PROGRESS_WARNING,
        }
      case 'on_hold':
        return {
          timestamp: task.on_hold_at,
          icon: PauseCircle,
          label: 'On hold',
          isWarning: task.on_hold_at && getDurationMs(task.on_hold_at) > DURATION_THRESHOLDS.ON_HOLD_WARNING,
        }
      case 'archived':
        return {
          timestamp: task.archived_at,
          icon: CheckCircle2,
          label: 'Done',
        }
      default:
        return null
    }
  }

  const timeInfo = getStatusTimeInfo()
  const formattedTime = timeInfo?.timestamp ? formatCompactDuration(timeInfo.timestamp) : ''
  const TimeIcon = timeInfo?.icon || Clock

  const handleClick = () => {
    if (!isDragging && !isSortableDragging) {
      router.push(`/tasks/${task.id}`)
    }
  }

  // Overlay card styles (the one that follows the cursor)
  const overlayStyles = isOverlay ? {
    boxShadow: '0 15px 30px -10px rgba(0, 0, 0, 0.3), 0 5px 15px -5px rgba(0, 0, 0, 0.2)',
    transform: 'rotate(3deg) scale(1.02)',
    cursor: 'grabbing',
  } : {}

  return (
    <div
      ref={setNodeRef}
      style={{ ...style, ...overlayStyles }}
      className={cn(
        'group bg-card rounded-xl border p-3 cursor-pointer',
        'transition-[box-shadow,border-color] duration-200',
        'hover:shadow-md hover:border-primary/20',
        // When dragging, add visual feedback
        isSortableDragging && 'border-dashed border-primary/40',
        // Overlay specific styles
        isOverlay && 'shadow-2xl border-primary/30 bg-card/95 backdrop-blur-sm',
      )}
      onClick={handleClick}
    >
      <div className="flex items-start gap-2">
        {/* Drag handle - always visible for better discoverability */}
        <button
          {...attributes}
          {...listeners}
          className={cn(
            'transition-all duration-150 cursor-grab active:cursor-grabbing p-0.5 -ml-1',
            'text-muted-foreground/50 hover:text-muted-foreground',
            'opacity-40 group-hover:opacity-100',
            isOverlay && 'opacity-100 text-primary'
          )}
          onClick={(e) => e.stopPropagation()}
        >
          <GripVertical className="h-4 w-4" />
        </button>

        <div className="flex-1 min-w-0">
          {/* Title row */}
          <div className="flex items-start justify-between gap-2 mb-2">
            <h4 className="text-sm font-medium line-clamp-2 flex-1">{task.title}</h4>
            {/* Priority indicator */}
            <span
              className={cn('w-2 h-2 rounded-full flex-shrink-0 mt-1.5', priorityConfig?.color)}
              title={priorityConfig?.label}
            />
          </div>

          {/* Bottom row: Assignee + Deadline */}
          <div className="flex items-center justify-between gap-2">
            {/* Assignee */}
            <div className="flex items-center gap-1.5 min-w-0">
              {primaryAssignee ? (
                <>
                  <Avatar className="h-5 w-5 flex-shrink-0">
                    {primaryAssignee.avatar_url && (
                      <AvatarImage src={primaryAssignee.avatar_url} alt={primaryAssignee.name} />
                    )}
                    <AvatarFallback className="text-[8px] bg-muted">
                      {getInitials(primaryAssignee.name)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-xs text-muted-foreground truncate">
                    {primaryAssignee.name.split(' ')[0]}
                    {additionalCount > 0 && ` +${additionalCount}`}
                  </span>
                </>
              ) : (
                <span className="text-xs text-muted-foreground">Unassigned</span>
              )}
            </div>

            {/* Status Time */}
            {formattedTime && (
              <span
                className={cn(
                  'text-[10px] font-medium whitespace-nowrap flex items-center gap-1 flex-shrink-0',
                  timeInfo?.isWarning ? 'text-amber-500' : 'text-muted-foreground'
                )}
                title={timeInfo?.label}
              >
                <TimeIcon className="h-3 w-3" />
                {formattedTime}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// Overlay version for drag preview - styled like Jira/Trello floating card
export function KanbanCardOverlay({ task }: { task: TaskWithUsers }) {
  return <KanbanCard task={task} isDragging isOverlay />
}
