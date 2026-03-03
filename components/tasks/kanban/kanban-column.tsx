'use client'

import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { cn } from '@/lib/utils'
import { TASK_STATUS_CONFIG } from '@/lib/constants/task'
import { KanbanCard } from './kanban-card'
import type { TaskStatus, TaskWithUsers } from '@/lib/types'

interface KanbanColumnProps {
  status: TaskStatus
  tasks: TaskWithUsers[]
  isOver?: boolean
}

export function KanbanColumn({ status, tasks, isOver }: KanbanColumnProps) {
  const { setNodeRef, isOver: isDroppableOver } = useDroppable({ id: status })
  const config = TASK_STATUS_CONFIG[status]
  const Icon = config.icon

  const taskIds = tasks.map(t => t.id)
  const isActive = isOver || isDroppableOver

  return (
    <div className="flex flex-col min-w-[280px] max-w-[320px] w-full">
      {/* Column header */}
      <div className="flex items-center gap-2 px-3 py-2 mb-2">
        <div className={cn('p-1.5 rounded-lg', config.bg)}>
          <Icon className={cn('h-4 w-4', config.color)} />
        </div>
        <h3 className="font-semibold text-sm">{config.label}</h3>
        <span className="text-xs text-muted-foreground tabular-nums ml-auto">
          {tasks.length}
        </span>
      </div>

      {/* Droppable area */}
      <div
        ref={setNodeRef}
        className={cn(
          'flex-1 rounded-xl p-2 space-y-2 min-h-[200px] transition-colors',
          'bg-muted/30 border-2 border-dashed border-transparent',
          isActive && 'border-primary/30 bg-primary/5',
        )}
      >
        <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
          {tasks.length === 0 ? (
            <div className="flex items-center justify-center h-24 text-xs text-muted-foreground">
              No tasks
            </div>
          ) : (
            tasks.map(task => <KanbanCard key={task.id} task={task} />)
          )}
        </SortableContext>
      </div>
    </div>
  )
}
