'use client'

import { useCallback } from 'react'
import { m, AnimatePresence, useReducedMotion } from 'framer-motion'
import { cn } from '@/lib/utils'
import { GroupedReaction } from '@/lib/types'
import { QUICK_REACTIONS } from '@/hooks/use-reactions'
import { haptics } from '@/lib/haptics'
import { Copy, Smile } from 'lucide-react'
import { toast } from 'sonner'
import {
  reactionVariants,
  reactionBarVariants,
  reactionEmojiVariants,
  springs,
} from '@/lib/animations'
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
  const prefersReducedMotion = useReducedMotion()

  const handleToggle = useCallback((emoji: string) => {
    haptics.light()
    onToggle(emoji)
  }, [onToggle])

  if (reactions.length === 0) return null

  return (
    <TooltipProvider delayDuration={400}>
      <div
        className={cn(
          'flex flex-wrap gap-1.5 mt-1.5',
          isOwn ? 'justify-end' : 'justify-start'
        )}
      >
        <AnimatePresence mode="popLayout">
          {reactions.map(({ emoji, count, users, hasReacted }) => (
            <m.div
              key={emoji}
              variants={prefersReducedMotion ? undefined : reactionVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              whileHover={prefersReducedMotion ? undefined : "hover"}
              whileTap={prefersReducedMotion ? undefined : "tap"}
              layout
            >
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => handleToggle(emoji)}
                    className={cn(
                      'inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs',
                      'border transition-colors touch-manipulation',
                      'min-h-[28px] min-w-[36px]',
                      hasReacted
                        ? 'bg-primary/15 border-primary/40 shadow-sm'
                        : 'bg-background/90 border-border/60 hover:bg-muted/50'
                    )}
                  >
                    <span className="text-base leading-none">{emoji}</span>
                    {/* Only show count if more than 1 */}
                    {count > 1 && (
                      <span className="text-xs text-muted-foreground leading-none font-medium">
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
            </m.div>
          ))}
        </AnimatePresence>
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
      haptics.light()
      onSelect(emoji)
      onClose()
    },
    [onSelect, onClose]
  )

  const prefersReducedMotion = useReducedMotion()

  return (
    <m.div
      variants={prefersReducedMotion ? undefined : reactionBarVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      className={cn(
        'flex items-center gap-1 px-2 py-2',
        'bg-popover border border-border rounded-full shadow-xl'
      )}
      onClick={(e) => e.stopPropagation()}
      onTouchStart={(e) => e.stopPropagation()}
    >
      {QUICK_REACTIONS.map((emoji, index) => (
        <m.button
          key={emoji}
          variants={prefersReducedMotion ? undefined : reactionEmojiVariants}
          whileHover={prefersReducedMotion ? undefined : "hover"}
          whileTap={prefersReducedMotion ? undefined : "tap"}
          custom={index}
          onClick={() => handleSelect(emoji)}
          className={cn(
            'p-2 text-2xl rounded-full transition-colors touch-manipulation',
            'hover:bg-muted',
            'min-w-[44px] min-h-[44px] flex items-center justify-center',
            currentEmoji === emoji && 'bg-primary/20'
          )}
        >
          {emoji}
        </m.button>
      ))}
    </m.div>
  )
}

interface MessageActionsProps {
  onReact: () => void
  onReply: () => void
  isOwn: boolean
}

// Action buttons that appear on message hover/long-press (desktop)
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

interface MobileMessageActionsProps {
  onReact: () => void
  onCopy: () => void
  onClose: () => void
  messageContent?: string
}

// WhatsApp-style floating action menu for mobile (appears on long press)
export function MobileMessageActions({
  onReact,
  onCopy,
  onClose,
  messageContent,
}: MobileMessageActionsProps) {
  const handleReact = useCallback(() => {
    haptics.light()
    onReact()
  }, [onReact])

  const handleCopy = useCallback(async () => {
    haptics.light()
    if (messageContent) {
      try {
        await navigator.clipboard.writeText(messageContent)
        toast.success('Copied to clipboard')
      } catch {
        toast.error('Failed to copy')
      }
    }
    onCopy()
    onClose()
  }, [messageContent, onCopy, onClose])

  const prefersReducedMotion = useReducedMotion()

  return (
    <m.div
      variants={prefersReducedMotion ? undefined : reactionBarVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      className={cn(
        'flex items-center gap-2 px-3 py-2',
        'bg-popover border border-border rounded-2xl shadow-xl'
      )}
      onClick={(e) => e.stopPropagation()}
      onTouchStart={(e) => e.stopPropagation()}
    >
      <m.button
        whileHover={prefersReducedMotion ? undefined : { scale: 1.05 }}
        whileTap={prefersReducedMotion ? undefined : { scale: 0.95 }}
        transition={springs.micro}
        onClick={handleReact}
        className={cn(
          'flex flex-col items-center gap-1 px-4 py-2 rounded-xl',
          'hover:bg-muted transition-colors touch-manipulation min-w-[60px]'
        )}
      >
        <Smile className="w-6 h-6 text-foreground" />
        <span className="text-xs text-muted-foreground">React</span>
      </m.button>
      {messageContent && (
        <>
          <div className="w-px h-10 bg-border" />
          <m.button
            whileHover={prefersReducedMotion ? undefined : { scale: 1.05 }}
            whileTap={prefersReducedMotion ? undefined : { scale: 0.95 }}
            transition={springs.micro}
            onClick={handleCopy}
            className={cn(
              'flex flex-col items-center gap-1 px-4 py-2 rounded-xl',
              'hover:bg-muted transition-colors touch-manipulation min-w-[60px]'
            )}
          >
            <Copy className="w-6 h-6 text-foreground" />
            <span className="text-xs text-muted-foreground">Copy</span>
          </m.button>
        </>
      )}
    </m.div>
  )
}
