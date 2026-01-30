'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { m, useReducedMotion } from 'framer-motion'
import { Reply } from 'lucide-react'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'
import { formatMessageTime } from '@/lib/utils/date'
import { messageBubbleVariants } from '@/lib/animations'
import { haptics } from '@/lib/haptics'
import { useSwipeGesture } from '@/hooks/use-swipe-gesture'
import { FileAttachment } from '@/components/messages/file-attachment'
import type { ChatBubbleProps, ChatMessage } from './types'
import { isEmojiOnlyMessage } from './types'
import { AudioMessagePlayer } from '@/components/messages/voice-recorder'

// Quick reactions component (inline for simplicity - uses existing logic pattern)
const QUICK_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🙏']

interface QuickReactionsBarProps {
    onSelect: (emoji: string) => void
    currentEmoji?: string | null
    onClose: () => void
}

function QuickReactionsBar({ onSelect, currentEmoji, onClose }: QuickReactionsBarProps) {
    return (
        <div className="flex items-center gap-1 bg-card border rounded-full px-2 py-1.5 shadow-lg">
            {QUICK_REACTIONS.map((emoji) => (
                <button
                    key={emoji}
                    onClick={() => onSelect(emoji)}
                    className={cn(
                        'text-xl hover:scale-125 transition-transform p-1 rounded-full',
                        currentEmoji === emoji && 'bg-primary/20 ring-1 ring-primary'
                    )}
                >
                    {emoji}
                </button>
            ))}
            <button
                onClick={onClose}
                className="ml-1 p-1 text-muted-foreground hover:text-foreground"
            >
                ✕
            </button>
        </div>
    )
}

// Reaction badges display
interface ReactionBadgesProps {
    reactions: Array<{ emoji: string; count: number; hasReacted: boolean }>
    onToggle?: (emoji: string) => void
    isOwn: boolean
}

function ReactionBadges({ reactions, onToggle, isOwn }: ReactionBadgesProps) {
    if (reactions.length === 0) return null

    return (
        <div className={cn(
            'flex flex-wrap gap-1 mt-1',
            isOwn ? 'justify-end' : 'justify-start'
        )}>
            {reactions.map(({ emoji, count, hasReacted }) => (
                <button
                    key={emoji}
                    onClick={() => onToggle?.(emoji)}
                    disabled={!onToggle}
                    className={cn(
                        'inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-xs',
                        'bg-muted/80 hover:bg-muted transition-colors',
                        hasReacted && 'ring-1 ring-primary bg-primary/10',
                        !onToggle && 'cursor-default'
                    )}
                >
                    <span>{emoji}</span>
                    <span className="text-muted-foreground">{count}</span>
                </button>
            ))}
        </div>
    )
}

// Mobile actions popup
interface MobileMessageActionsProps {
    onReact?: () => void
    onReply?: () => void
    onCopy?: () => void
    onClose: () => void
    messageContent?: string
}

function MobileMessageActions({ onReact, onReply, onCopy, onClose, messageContent }: MobileMessageActionsProps) {
    const handleCopy = () => {
        if (messageContent) {
            navigator.clipboard.writeText(messageContent)
        }
        onCopy?.()
        onClose()
    }

    return (
        <div className="flex items-center gap-2 bg-card border rounded-lg px-3 py-2 shadow-lg">
            {onReact && (
                <button onClick={onReact} className="p-2 hover:bg-muted rounded-lg">
                    <span className="text-lg">😀</span>
                </button>
            )}
            {onReply && (
                <button onClick={onReply} className="p-2 hover:bg-muted rounded-lg">
                    <Reply className="w-5 h-5" />
                </button>
            )}
            {messageContent && (
                <button onClick={handleCopy} className="p-2 hover:bg-muted rounded-lg text-sm">
                    Copy
                </button>
            )}
        </div>
    )
}

/**
 * Shared ChatBubble component for displaying messages.
 * Works for both conversation messages and task messages.
 * Features are enabled/disabled via callback props.
 */
export function ChatBubble({
    message,
    allMessages = [],
    isOwn,
    currentUser,
    isGroupChat = false,
    showAvatar = false,
    showSenderName = false,
    onReact,
    onReply,
    onCopy,
    groupedReactions = [],
    userCurrentEmoji,
    className,
}: ChatBubbleProps) {
    const [showReactions, setShowReactions] = useState(false)
    const [showMobileActions, setShowMobileActions] = useState(false)
    const longPressTimer = useRef<NodeJS.Timeout | null>(null)
    const bubbleRef = useRef<HTMLDivElement>(null)
    const prefersReducedMotion = useReducedMotion()

    const isVoiceMessage = message.file_type?.startsWith('audio/')
    const isEmojiOnly = isEmojiOnlyMessage(message.content) && !message.reply_to_id
    const timestamp = formatMessageTime(message.created_at)

    // Find the replied-to message
    const replyToMessage = message.reply_to_id
        ? allMessages.find((m: ChatMessage) => m.id === message.reply_to_id)
        : null

    // Swipe to reply gesture
    const handleSwipeReply = useCallback(() => {
        if (!onReply) return
        haptics.medium()
        onReply()
    }, [onReply])

    const { ref: swipeRef, handlers: swipeHandlers } = useSwipeGesture({
        onSwipeRight: handleSwipeReply,
        threshold: 60,
    })

    const handleReaction = useCallback((emoji: string) => {
        if (!currentUser || !onReact) return
        haptics.light()
        onReact(emoji)
        setShowReactions(false)
        setShowMobileActions(false)
    }, [currentUser, onReact])

    // Touch handlers for long press
    const handleTouchStart = useCallback((e: React.TouchEvent) => {
        if (onReply) swipeHandlers.onTouchStart(e)

        longPressTimer.current = setTimeout(() => {
            haptics.medium()
            setShowMobileActions(true)
        }, 400)
    }, [swipeHandlers, onReply])

    const handleTouchMove = useCallback((e: React.TouchEvent) => {
        if (onReply) swipeHandlers.onTouchMove(e)
        if (longPressTimer.current) {
            clearTimeout(longPressTimer.current)
            longPressTimer.current = null
        }
    }, [swipeHandlers, onReply])

    const handleTouchEnd = useCallback(() => {
        if (onReply) swipeHandlers.onTouchEnd()
        if (longPressTimer.current) {
            clearTimeout(longPressTimer.current)
            longPressTimer.current = null
        }
    }, [swipeHandlers, onReply])

    // Close popups on outside click
    useEffect(() => {
        if (!showReactions && !showMobileActions) return

        const handleClick = (e: MouseEvent) => {
            if (bubbleRef.current?.contains(e.target as Node)) return
            setShowReactions(false)
            setShowMobileActions(false)
        }

        const timer = setTimeout(() => {
            document.addEventListener('click', handleClick)
            document.addEventListener('touchstart', handleClick as EventListener)
        }, 100)

        return () => {
            clearTimeout(timer)
            document.removeEventListener('click', handleClick)
            document.removeEventListener('touchstart', handleClick as EventListener)
        }
    }, [showReactions, showMobileActions])

    // Deleted message
    if (message.is_deleted) {
        return (
            <m.div
                layout
                custom={isOwn}
                variants={prefersReducedMotion ? undefined : messageBubbleVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                className={cn('flex', isOwn ? 'justify-end' : 'justify-start', className)}
            >
                {isGroupChat && !isOwn && <div className="w-8 mr-2 flex-shrink-0" />}
                <div className="px-4 py-2 rounded-xl bg-muted/50 text-muted-foreground italic text-sm">
                    Message deleted
                </div>
            </m.div>
        )
    }

    return (
        <m.div
            layout
            custom={isOwn}
            variants={prefersReducedMotion ? undefined : messageBubbleVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            className={cn('flex group', isOwn ? 'justify-end' : 'justify-start', className)}
        >
            {/* Avatar for group chats */}
            {isGroupChat && !isOwn && (
                <div className="w-8 mr-2 flex-shrink-0 self-end">
                    {showAvatar ? (
                        <Avatar className="h-8 w-8">
                            {message.sender?.avatar_url && (
                                <AvatarImage src={message.sender.avatar_url} alt={message.sender?.name || ''} />
                            )}
                            <AvatarFallback className="bg-muted text-muted-foreground text-xs">
                                {message.sender?.name?.charAt(0).toUpperCase() || '?'}
                            </AvatarFallback>
                        </Avatar>
                    ) : null}
                </div>
            )}

            {/* Desktop action buttons */}
            {(onReact || onReply) && (
                <div
                    className={cn(
                        'hidden sm:flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity',
                        isOwn ? 'order-first mr-2' : 'order-last ml-2'
                    )}
                >
                    {onReact && (
                        <button
                            onClick={() => setShowReactions(true)}
                            className="p-1.5 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                            title="React"
                        >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                        </button>
                    )}
                    {onReply && (
                        <button
                            onClick={onReply}
                            className="p-1.5 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                            title="Reply"
                        >
                            <Reply className="w-4 h-4" />
                        </button>
                    )}
                </div>
            )}

            <div
                ref={(el) => {
                    bubbleRef.current = el
                    swipeRef.current = el
                }}
                className={cn(
                    'max-w-[80%] sm:max-w-[70%] relative select-none',
                    isGroupChat && !isOwn && 'max-w-[calc(80%-40px)] sm:max-w-[calc(70%-40px)]'
                )}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
                onTouchCancel={handleTouchEnd}
                onDoubleClick={() => {
                    if (onReact) {
                        haptics.light()
                        setShowReactions(true)
                    }
                }}
            >
                {/* Sender name for group chats */}
                {showSenderName && (
                    <p className="text-xs font-medium text-primary mb-1 ml-1">
                        {message.sender?.name || 'Unknown'}
                    </p>
                )}

                {/* Mobile actions popup */}
                {showMobileActions && (
                    <div
                        className={cn(
                            'absolute bottom-full mb-2 z-30 sm:hidden',
                            isOwn ? 'right-0' : 'left-0'
                        )}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <MobileMessageActions
                            onReact={onReact ? () => {
                                setShowMobileActions(false)
                                setShowReactions(true)
                            } : undefined}
                            onReply={onReply}
                            onCopy={onCopy}
                            onClose={() => setShowMobileActions(false)}
                            messageContent={message.content || undefined}
                        />
                    </div>
                )}

                {/* Reaction picker popup */}
                {showReactions && onReact && (
                    <div
                        className={cn(
                            'absolute bottom-full mb-2 z-20',
                            isOwn ? 'right-0' : 'left-0'
                        )}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <QuickReactionsBar
                            onSelect={handleReaction}
                            currentEmoji={userCurrentEmoji}
                            onClose={() => setShowReactions(false)}
                        />
                    </div>
                )}

                {/* Message content */}
                {message.file_url ? (
                    <div className="space-y-1">
                        {isVoiceMessage ? (
                            <AudioMessagePlayer
                                audioUrl={message.file_url}
                                className={cn(
                                    isOwn
                                        ? 'bg-primary text-primary-foreground rounded-br-sm'
                                        : 'bg-muted text-foreground rounded-bl-sm'
                                )}
                            />
                        ) : (
                            <FileAttachment
                                fileUrl={message.file_url}
                                fileName={message.file_name || 'File'}
                                fileType={message.file_type || 'application/octet-stream'}
                                fileSize={message.file_size || undefined}
                            />
                        )}
                        {message.content && !isVoiceMessage && (
                            <div
                                className={cn(
                                    'rounded-2xl px-3 py-2',
                                    isOwn
                                        ? 'bg-primary text-primary-foreground rounded-br-sm'
                                        : 'bg-muted text-foreground rounded-bl-sm'
                                )}
                            >
                                <p className="text-sm whitespace-pre-wrap break-words">{message.content}</p>
                                <div className={cn(
                                    'flex items-center justify-end gap-1 mt-1',
                                    isOwn ? 'text-primary-foreground/70' : 'text-muted-foreground'
                                )}>
                                    <span className="text-[10px]">{timestamp}</span>
                                </div>
                            </div>
                        )}
                        {!message.content && (
                            <div className={cn('flex items-center gap-1', isOwn && 'justify-end')}>
                                <span className="text-[10px] text-muted-foreground">{timestamp}</span>
                            </div>
                        )}
                    </div>
                ) : isEmojiOnly ? (
                    <div className="active:opacity-90 transition-opacity">
                        <p className="text-5xl leading-tight">{message.content}</p>
                        <div className={cn(
                            'flex items-center gap-1 mt-1',
                            isOwn ? 'justify-end' : 'justify-start'
                        )}>
                            <span className="text-[10px] text-muted-foreground">{timestamp}</span>
                        </div>
                    </div>
                ) : (
                    <div
                        className={cn(
                            'rounded-2xl overflow-hidden active:opacity-90 transition-opacity',
                            isOwn
                                ? 'bg-primary text-primary-foreground rounded-br-sm'
                                : 'bg-muted text-foreground rounded-bl-sm'
                        )}
                    >
                        {/* Reply reference */}
                        {replyToMessage && (
                            <div
                                className={cn(
                                    'px-3 pt-2 pb-1 border-l-2 border-primary-foreground/30 mx-1 mt-1 rounded',
                                    isOwn ? 'bg-primary-foreground/10' : 'bg-background/30'
                                )}
                            >
                                <p className={cn(
                                    'text-xs font-medium truncate',
                                    isOwn ? 'text-primary-foreground/90' : 'text-primary'
                                )}>
                                    {replyToMessage.sender?.name || 'Unknown'}
                                </p>
                                <p className={cn(
                                    'text-xs truncate',
                                    isOwn ? 'text-primary-foreground/70' : 'text-muted-foreground'
                                )}>
                                    {replyToMessage.content || (replyToMessage.file_name ? `File: ${replyToMessage.file_name}` : 'Message')}
                                </p>
                            </div>
                        )}
                        <div className="px-3 py-2">
                            <p className="text-sm whitespace-pre-wrap break-words">{message.content}</p>
                            <div className={cn(
                                'flex items-center justify-end gap-1 mt-1',
                                isOwn ? 'text-primary-foreground/70' : 'text-muted-foreground'
                            )}>
                                <span className="text-[10px]">{timestamp}</span>
                            </div>
                        </div>
                    </div>
                )}

                {/* Reaction badges */}
                {groupedReactions.length > 0 && (
                    <ReactionBadges
                        reactions={groupedReactions}
                        onToggle={onReact ? handleReaction : undefined}
                        isOwn={isOwn}
                    />
                )}
            </div>
        </m.div>
    )
}
