'use client'

import { m, useReducedMotion } from 'framer-motion'
import { UserBasic } from '@/lib/types'
import { typingBubbleVariants } from '@/lib/animations'

interface TypingBubbleProps {
  typingUsers: UserBasic[]
}

/**
 * TypingBubble - Animated typing indicator for chat messages
 *
 * Displays a visual bubble with animated dots when users are typing.
 * Supports single and multiple typing users with appropriate messaging.
 */
export function TypingBubble({ typingUsers }: TypingBubbleProps) {
  const prefersReducedMotion = useReducedMotion()

  if (typingUsers.length === 0) return null

  const displayText =
    typingUsers.length === 1
      ? `${typingUsers[0].name} is typing...`
      : typingUsers.length === 2
        ? `${typingUsers[0].name} and ${typingUsers[1].name} are typing...`
        : `${typingUsers.length} people are typing...`

  return (
    <m.div
      variants={prefersReducedMotion ? undefined : typingBubbleVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      className="flex items-start gap-3 px-4 py-2"
    >
      {/* Bubble container */}
      <div className="flex items-center gap-2 px-4 py-3 bg-muted rounded-2xl rounded-bl-sm shadow-sm">
        {/* Animated dots */}
        <div className="flex items-center gap-1" role="status" aria-label={displayText}>
          <span
            className="w-2 h-2 bg-muted-foreground/60 rounded-full animate-bounce"
            style={{ animationDelay: '0ms', animationDuration: '1.4s' }}
          />
          <span
            className="w-2 h-2 bg-muted-foreground/60 rounded-full animate-bounce"
            style={{ animationDelay: '160ms', animationDuration: '1.4s' }}
          />
          <span
            className="w-2 h-2 bg-muted-foreground/60 rounded-full animate-bounce"
            style={{ animationDelay: '320ms', animationDuration: '1.4s' }}
          />
        </div>
      </div>

      {/* Text indicator */}
      <span className="text-xs text-muted-foreground mt-2 flex-1">
        {displayText}
      </span>
    </m.div>
  )
}
