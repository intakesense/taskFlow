'use client'

import { useRef, useEffect } from 'react'
import { m, AnimatePresence } from 'framer-motion'
import { ClipboardList } from 'lucide-react'
import { ProgressEntry } from './progress-entry'
import { ProgressInput } from './progress-input'
import type { ProgressUpdatesByDate } from '@/lib/types'

interface ProgressTimelineProps {
  progressByDate: ProgressUpdatesByDate[]
  currentUserId: string
  isParticipant: boolean
  isAssignee: boolean
  onCreateProgress: (content: string) => Promise<void>
  onAddComment: (progressId: string, content: string) => Promise<void>
  isCreating?: boolean
  isAddingComment?: boolean
  isLoading?: boolean
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-full py-12 px-4 text-center">
      <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
        <ClipboardList className="h-8 w-8 text-muted-foreground" />
      </div>
      <h3 className="font-medium text-lg mb-1">No progress updates yet</h3>
      <p className="text-sm text-muted-foreground max-w-[280px]">
        Assignees can share their progress on this task. Updates will appear here.
      </p>
    </div>
  )
}

function DateDivider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 py-4">
      <div className="flex-1 h-px bg-border" />
      <span className="text-xs font-semibold text-muted-foreground tracking-wider">
        {label}
      </span>
      <div className="flex-1 h-px bg-border" />
    </div>
  )
}

export function ProgressTimeline({
  progressByDate,
  currentUserId,
  isParticipant,
  isAssignee,
  onCreateProgress,
  onAddComment,
  isCreating = false,
  isAddingComment = false,
  isLoading = false,
}: ProgressTimelineProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  // Scroll to bottom when new updates are added
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [progressByDate])

  const hasProgress = progressByDate.length > 0

  if (isLoading) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex-1 flex items-center justify-center">
          <div className="animate-pulse text-muted-foreground">Loading progress...</div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Scrollable content */}
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto px-4"
      >
        {!hasProgress ? (
          <EmptyState />
        ) : (
          <AnimatePresence initial={false}>
            {progressByDate.map((dateGroup) => (
              <m.div
                key={dateGroup.date}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <DateDivider label={dateGroup.dateLabel} />
                {dateGroup.updates.map((update) => (
                  <ProgressEntry
                    key={update.id}
                    update={update}
                    currentUserId={currentUserId}
                    isParticipant={isParticipant}
                    onAddComment={onAddComment}
                    isAddingComment={isAddingComment}
                  />
                ))}
              </m.div>
            ))}
          </AnimatePresence>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Progress input - only for assignees */}
      {isAssignee && (
        <ProgressInput
          onSubmit={onCreateProgress}
          isSubmitting={isCreating}
          placeholder="Share your progress..."
        />
      )}

      {/* Show hint for non-assignees */}
      {isParticipant && !isAssignee && (
        <div className="px-4 py-3 border-t bg-muted/30 text-center">
          <p className="text-xs text-muted-foreground">
            Only assignees can post progress updates. You can comment on existing updates.
          </p>
        </div>
      )}
    </div>
  )
}
