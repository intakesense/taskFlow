'use client'

import Link from 'next/link'
import { Calendar, Clock, CheckCircle2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatRelative } from '@/lib/utils/date'
import type { TaskWithUsers, TaskStatus, TaskPriority } from '@/lib/types'

interface TaskMiniCardProps {
  task: TaskWithUsers
}

const STATUS_CONFIG: Record<TaskStatus, { label: string; color: string; icon: typeof Clock }> = {
  pending: { label: 'Pending', color: 'text-amber-600 bg-amber-500/10', icon: Clock },
  in_progress: { label: 'In Progress', color: 'text-blue-600 bg-blue-500/10', icon: Clock },
  on_hold: { label: 'On Hold', color: 'text-yellow-600 bg-yellow-500/10', icon: Clock },
  archived: { label: 'Done', color: 'text-emerald-600 bg-emerald-500/10', icon: CheckCircle2 },
}

const PRIORITY_COLOR: Record<TaskPriority, string> = {
  low: 'bg-blue-500',
  medium: 'bg-yellow-500',
  high: 'bg-red-500',
}

export function TaskMiniCard({ task }: TaskMiniCardProps) {
  const status = STATUS_CONFIG[task.status as TaskStatus] || STATUS_CONFIG.pending
  const StatusIcon = status.icon
  const isOverdue = task.deadline && new Date(task.deadline) < new Date() && task.status !== 'archived'

  return (
    <Link
      href={`/tasks/${task.id}`}
      className={cn(
        'block px-3 py-2.5 rounded-xl bg-muted/50 transition-colors',
        'hover:bg-muted active:scale-[0.99]'
      )}
    >
      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{task.title}</p>
          <div className="flex items-center gap-2 mt-1">
            {/* Status */}
            <span className={cn('inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium', status.color)}>
              <StatusIcon className="h-2.5 w-2.5" />
              {status.label}
            </span>
            {/* Priority */}
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-muted text-[10px] font-medium text-muted-foreground">
              <span className={cn('w-1.5 h-1.5 rounded-full', PRIORITY_COLOR[task.priority as TaskPriority])} />
              {task.priority}
            </span>
          </div>
        </div>
        {/* Deadline */}
        {task.deadline && (
          <span className={cn(
            'text-[10px] font-medium whitespace-nowrap flex items-center gap-1',
            isOverdue ? 'text-red-500' : 'text-muted-foreground'
          )}>
            <Calendar className="h-2.5 w-2.5" />
            {formatRelative(task.deadline)}
          </span>
        )}
      </div>
    </Link>
  )
}
