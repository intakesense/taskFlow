import { Clock, CheckCircle2, PauseCircle, CircleDashed } from 'lucide-react'
import type { TaskStatus, TaskPriority } from '@/lib/types'

export const TASK_STATUS = {
  PENDING: 'pending',
  IN_PROGRESS: 'in_progress',
  ON_HOLD: 'on_hold',
  ARCHIVED: 'archived',
} as const

export const TASK_STATUS_CONFIG: Record<
  TaskStatus,
  { label: string; color: string; bg: string; icon: typeof Clock }
> = {
  pending: {
    label: 'Pending',
    color: 'text-amber-600',
    bg: 'bg-amber-500/10',
    icon: CircleDashed,
  },
  in_progress: {
    label: 'In Progress',
    color: 'text-blue-600',
    bg: 'bg-blue-500/10',
    icon: Clock,
  },
  on_hold: {
    label: 'On Hold',
    color: 'text-yellow-600',
    bg: 'bg-yellow-500/10',
    icon: PauseCircle,
  },
  archived: {
    label: 'Done',
    color: 'text-emerald-600',
    bg: 'bg-emerald-500/10',
    icon: CheckCircle2,
  },
}

export const TASK_PRIORITY_CONFIG: Record<TaskPriority, { label: string; color: string }> = {
  low: { label: 'Low', color: 'bg-blue-500' },
  medium: { label: 'Medium', color: 'bg-yellow-500' },
  high: { label: 'High', color: 'bg-red-500' },
}

// Kanban column order
export const KANBAN_COLUMNS: TaskStatus[] = ['pending', 'in_progress', 'on_hold', 'archived']
