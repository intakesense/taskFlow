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
  // Show active state when dragging over this column (either from prop or droppable detection)
  const isActive = isOver || isDroppableOver

  return (
    <div
      className={cn(
        'flex flex-col min-w-[280px] max-w-[320px] w-full',
        'transition-transform duration-200',
        // Subtle scale effect when card is hovering over column
        isActive && 'scale-[1.01]'
      )}
    >
      {/* Column header - highlight when active */}
      <div
        className={cn(
          'flex items-center gap-2 px-3 py-2 mb-2 rounded-lg transition-colors duration-200',
          isActive && 'bg-primary/5'
        )}
      >
        <div className={cn(
          'p-1.5 rounded-lg transition-all duration-200',
          config.bg,
          isActive && 'ring-2 ring-primary/30 ring-offset-1'
        )}>
          <Icon className={cn('h-4 w-4', config.color)} />
        </div>
        <h3 className={cn(
          'font-semibold text-sm transition-colors duration-200',
          isActive && 'text-primary'
        )}>
          {config.label}
        </h3>
        <span className={cn(
          'text-xs tabular-nums ml-auto px-1.5 py-0.5 rounded-full transition-all duration-200',
          isActive
            ? 'bg-primary/10 text-primary font-medium'
            : 'text-muted-foreground'
        )}>
          {tasks.length}
        </span>
      </div>

      {/* Droppable area - Jira/Trello style */}
      <div
        ref={setNodeRef}
        className={cn(
          'flex-1 rounded-xl p-2 space-y-2 min-h-[200px]',
          'transition-all duration-200 ease-out',
          // Base style - subtle background
          'bg-muted/30',
          // Border style
          'border-2 border-dashed',
          isActive
            ? 'border-primary/50 bg-primary/5 shadow-[inset_0_0_20px_rgba(var(--primary),0.05)]'
            : 'border-transparent',
        )}
      >
        <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
          {tasks.length === 0 ? (
            <div
              className={cn(
                'flex items-center justify-center h-24 text-xs rounded-lg transition-all duration-200',
                isActive
                  ? 'text-primary/70 bg-primary/5 border border-dashed border-primary/30'
                  : 'text-muted-foreground'
              )}
            >
              {isActive ? 'Drop here' : 'No tasks'}
            </div>
          ) : (
            tasks.map(task => <KanbanCard key={task.id} task={task} />)
          )}
        </SortableContext>
      </div>
    </div>
  )
}
