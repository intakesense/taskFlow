'use client'

import { useCallback } from 'react'
import { cn } from '@/lib/utils'
import { GroupedReaction } from '@/lib/types'
import { QUICK_REACTIONS } from '@/hooks/use-reactions'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

interface ReactionBadgesProps {
  reactions: GroupedReaction[]
  onToggle: (emoji: string) => void
  isOwn: boolean
}

export function ReactionBadges({
  reactions,
  onToggle,
  isOwn,
}: ReactionBadgesProps) {
  if (reactions.length === 0) return null

  return (
    <TooltipProvider delayDuration={400}>
      <div
        className={cn(
          'flex flex-wrap gap-1 mt-1',
          isOwn ? 'justify-end' : 'justify-start'
        )}
      >
        {reactions.map(({ emoji, count, users, hasReacted }) => (
          <Tooltip key={emoji}>
            <TooltipTrigger asChild>
              <button
                onClick={() => onToggle(emoji)}
                className={cn(
                  'inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-xs',
                  'border active:scale-95 transition-transform touch-manipulation',
                  hasReacted
                    ? 'bg-primary/15 border-primary/40'
                    : 'bg-background/80 border-border/50'
                )}
              >
                <span className="text-sm leading-none">{emoji}</span>
                {/* Only show count if more than 1 */}
                {count > 1 && (
                  <span className="text-[10px] text-muted-foreground leading-none">
                    {count}
                  </span>
                )}
              </button>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-[200px] hidden sm:block">
              <p className="text-xs">
                {users.map((u) => u.name).join(', ')}
              </p>
            </TooltipContent>
          </Tooltip>
        ))}
      </div>
    </TooltipProvider>
  )
}

interface QuickReactionsBarProps {
  onSelect: (emoji: string) => void
  currentEmoji?: string
  onClose: () => void
}

// Floating reaction bar that appears on long press / hover
export function QuickReactionsBar({
  onSelect,
  currentEmoji,
  onClose,
}: QuickReactionsBarProps) {
  const handleSelect = useCallback(
    (emoji: string) => {
      onSelect(emoji)
      onClose()
    },
    [onSelect, onClose]
  )

  return (
    <div
      className={cn(
        'flex items-center gap-0.5 px-2 py-1.5',
        'bg-popover border border-border rounded-full shadow-lg',
        'animate-in fade-in-0 zoom-in-95 duration-150'
      )}
      onClick={(e) => e.stopPropagation()}
    >
      {QUICK_REACTIONS.map((emoji) => (
        <button
          key={emoji}
          onClick={() => handleSelect(emoji)}
          className={cn(
            'p-1.5 text-xl rounded-full transition-all touch-manipulation',
            'hover:bg-muted active:scale-110',
            currentEmoji === emoji && 'bg-primary/20 scale-110'
          )}
        >
          {emoji}
        </button>
      ))}
    </div>
  )
}

interface MessageActionsProps {
  onReact: () => void
  onReply: () => void
  isOwn: boolean
}

// Action buttons that appear on message hover/long-press
export function MessageActions({
  onReact,
  onReply,
  isOwn,
}: MessageActionsProps) {
  return (
    <div
      className={cn(
        'absolute top-1/2 -translate-y-1/2 flex items-center gap-1',
        'opacity-0 group-hover:opacity-100 transition-opacity',
        'pointer-events-none group-hover:pointer-events-auto',
        isOwn ? '-left-16' : '-right-16'
      )}
    >
      <button
        onClick={onReact}
        className="p-1.5 rounded-full bg-muted/80 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors touch-manipulation"
        title="React"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </button>
      <button
        onClick={onReply}
        className="p-1.5 rounded-full bg-muted/80 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors touch-manipulation"
        title="Reply"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
        </svg>
      </button>
    </div>
  )
}
