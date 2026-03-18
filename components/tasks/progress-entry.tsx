'use client'

import { useState, useCallback } from 'react'
import { m, AnimatePresence } from 'framer-motion'
import { MessageCircle, Send, Loader2 } from 'lucide-react'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { formatProgressTime } from '@/lib/utils/date'
import { haptics } from '@/lib/haptics'
import type { ProgressUpdateWithComments, TaskMessageWithSender } from '@/lib/types'

interface ProgressEntryProps {
  update: ProgressUpdateWithComments
  currentUserId: string
  isParticipant: boolean
  onAddComment?: (progressId: string, content: string) => Promise<void>
  isAddingComment?: boolean
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

function ProgressComment({ comment }: { comment: TaskMessageWithSender }) {
  return (
    <div className="flex items-start gap-2 pl-8 py-1.5">
      <Avatar className="h-6 w-6 shrink-0">
        {comment.sender?.avatar_url && (
          <AvatarImage src={comment.sender.avatar_url} alt={comment.sender?.name || 'User'} />
        )}
        <AvatarFallback className="text-[10px]">
          {comment.sender?.name ? getInitials(comment.sender.name) : '?'}
        </AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2">
          <span className="text-xs font-medium text-foreground">
            {comment.sender?.name || 'Unknown'}
          </span>
          <span className="text-[10px] text-muted-foreground">
            {formatProgressTime(comment.created_at)}
          </span>
        </div>
        <p className="text-sm text-muted-foreground break-words">
          {comment.content || comment.message}
        </p>
      </div>
    </div>
  )
}

export function ProgressEntry({
  update,
  currentUserId,
  isParticipant,
  onAddComment,
  isAddingComment = false,
}: ProgressEntryProps) {
  const [showCommentInput, setShowCommentInput] = useState(false)
  const [commentValue, setCommentValue] = useState('')

  const handleSubmitComment = useCallback(async () => {
    if (!commentValue.trim() || !onAddComment || isAddingComment) return
    haptics.light()

    try {
      await onAddComment(update.id, commentValue.trim())
      setCommentValue('')
      setShowCommentInput(false)
    } catch {
      // Error handled by mutation
    }
  }, [commentValue, onAddComment, update.id, isAddingComment])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmitComment()
    }
    if (e.key === 'Escape') {
      setShowCommentInput(false)
      setCommentValue('')
    }
  }

  const isOwnUpdate = update.sender_id === currentUserId

  return (
    <m.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="py-3"
    >
      {/* Time */}
      <div className="text-xs font-medium text-muted-foreground mb-2">
        {formatProgressTime(update.created_at)}
      </div>

      {/* Progress card */}
      <div className={cn(
        'rounded-lg border bg-card p-3',
        isOwnUpdate && 'border-primary/20 bg-primary/5'
      )}>
        {/* Header with avatar and name */}
        <div className="flex items-center gap-2 mb-2">
          <Avatar className="h-8 w-8">
            {update.sender?.avatar_url && (
              <AvatarImage src={update.sender.avatar_url} alt={update.sender?.name || 'User'} />
            )}
            <AvatarFallback className="text-xs">
              {update.sender?.name ? getInitials(update.sender.name) : '?'}
            </AvatarFallback>
          </Avatar>
          <span className="font-medium text-sm">
            {update.sender?.name || 'Unknown'}
          </span>
        </div>

        {/* Progress content */}
        <p className="text-sm text-foreground whitespace-pre-wrap break-words">
          {update.content || update.message}
        </p>

        {/* Comments section - always visible */}
        {update.comments.length > 0 && (
          <div className="mt-3 border-t pt-2 space-y-1">
            {update.comments.map((comment) => (
              <ProgressComment key={comment.id} comment={comment} />
            ))}
          </div>
        )}

        {/* Add comment */}
        {isParticipant && onAddComment && (
          <div className="mt-3 pt-2 border-t">
            <AnimatePresence mode="wait">
              {showCommentInput ? (
                <m.div
                  key="input"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="flex items-center gap-2"
                >
                  <Input
                    value={commentValue}
                    onChange={(e) => setCommentValue(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Add a comment..."
                    disabled={isAddingComment}
                    className="flex-1 h-8 text-sm"
                    autoFocus
                  />
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={handleSubmitComment}
                    disabled={!commentValue.trim() || isAddingComment}
                    className="h-8 w-8 shrink-0"
                  >
                    {isAddingComment ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setShowCommentInput(false)
                      setCommentValue('')
                    }}
                    className="h-8 text-xs"
                  >
                    Cancel
                  </Button>
                </m.div>
              ) : (
                <m.button
                  key="button"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  onClick={() => setShowCommentInput(true)}
                  className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  <MessageCircle className="h-3.5 w-3.5" />
                  <span>Add comment</span>
                </m.button>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>
    </m.div>
  )
}
