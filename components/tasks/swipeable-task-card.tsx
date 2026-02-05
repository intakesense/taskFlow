'use client'

import { useRef, useState } from 'react'
import { CheckCircle2, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { TaskCardSocial } from './task-card-social'
import type { TaskWithUsers } from '@/lib/types'

interface SwipeableTaskCardProps {
  task: TaskWithUsers
  onStatusChange?: (taskId: string, status: string) => void
  onDelete?: (taskId: string) => void
  currentUserId?: string
}

export function SwipeableTaskCard({
  task,
  onStatusChange,
  onDelete,
  currentUserId,
}: SwipeableTaskCardProps) {
  const [offset, setOffset] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const startX = useRef(0)
  const currentX = useRef(0)

  const isAssignedByMe = currentUserId === task.assigned_by
  // Only the creator can complete tasks (swipe right to complete)
  const canComplete = isAssignedByMe && task.status === 'in_progress'
  // Only the person who assigned the task can delete it
  const canDelete = onDelete !== undefined && isAssignedByMe

  // Thresholds
  const SWIPE_THRESHOLD = 100
  const MAX_OFFSET = 150

  const handleTouchStart = (e: React.TouchEvent) => {
    startX.current = e.touches[0].clientX
    setIsDragging(true)
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging) return

    currentX.current = e.touches[0].clientX
    const diff = currentX.current - startX.current

    // Only allow right swipe if can complete, left swipe if can delete
    if (diff > 0 && canComplete) {
      setOffset(Math.min(diff, MAX_OFFSET))
    } else if (diff < 0 && canDelete) {
      setOffset(Math.max(diff, -MAX_OFFSET))
    }
  }

  const handleTouchEnd = () => {
    setIsDragging(false)

    // Right swipe - Complete
    if (offset > SWIPE_THRESHOLD && canComplete) {
      onStatusChange?.(task.id, 'archived')
      setOffset(0)
      return
    }

    // Left swipe - Delete
    if (offset < -SWIPE_THRESHOLD && canDelete) {
      onDelete?.(task.id)
      setOffset(0)
      return
    }

    // Reset if not enough swipe
    setOffset(0)
  }

  const handleMouseDown = (e: React.MouseEvent) => {
    startX.current = e.clientX
    setIsDragging(true)
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return

    currentX.current = e.clientX
    const diff = currentX.current - startX.current

    if (diff > 0 && canComplete) {
      setOffset(Math.min(diff, MAX_OFFSET))
    } else if (diff < 0 && canDelete) {
      setOffset(Math.max(diff, -MAX_OFFSET))
    }
  }

  const handleMouseUp = () => {
    if (!isDragging) return
    handleTouchEnd()
  }

  return (
    <div className="relative overflow-hidden rounded-2xl">
      {/* Action Buttons Background */}
      {canComplete && offset > 0 && (
        <div
          className="absolute inset-y-0 left-0 flex items-center px-6 bg-green-500 text-white rounded-l-2xl"
          style={{ width: `${offset}px` }}
        >
          <CheckCircle2 className="h-6 w-6" />
        </div>
      )}
      {canDelete && offset < 0 && (
        <div
          className="absolute inset-y-0 right-0 flex items-center justify-end px-6 bg-red-500 text-white rounded-r-2xl"
          style={{ width: `${Math.abs(offset)}px` }}
        >
          <Trash2 className="h-6 w-6" />
        </div>
      )}

      {/* Card */}
      <div
        className={cn(
          'transition-transform touch-pan-y',
          isDragging ? 'duration-0' : 'duration-300'
        )}
        style={{
          transform: `translateX(${offset}px)`,
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <TaskCardSocial
          task={task}
          onStatusChange={onStatusChange}
          onDelete={onDelete}
          currentUserId={currentUserId}
        />
      </div>

      {/* Swipe Hints (only show on first render) */}
      {offset === 0 && !isDragging && (
        <div className="absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r from-green-500/20 via-transparent to-red-500/20 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity" />
      )}
    </div>
  )
}
