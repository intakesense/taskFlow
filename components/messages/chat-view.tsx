'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { useAuth } from '@/lib/auth-context'
import { ConversationWithMembers, MessageWithSender, UserBasic } from '@/lib/types'
import { cn } from '@/lib/utils'
import { formatMessageTime } from '@/lib/utils/date'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { FileAttachment } from './file-attachment'
import { FilePreview } from '@/components/ui/file-upload'
import { TypingBubble } from './typing-bubble'
import { MessageStatus } from './message-status'
import { OnlineStatusBadge, OnlineStatusDot } from './online-status-badge'
import { VoiceRecorder, AudioMessagePlayer } from './voice-recorder'
import { ReactionBadges, QuickReactionsBar, MobileMessageActions } from './message-reactions'
import { useSetReaction, groupReactions, getUserReaction } from '@/hooks/use-reactions'
import { useSwipeGesture } from '@/hooks/use-swipe-gesture'
import { toast } from 'sonner'
import { haptics } from '@/lib/haptics'
import {
    ArrowLeft,
    Send,
    Paperclip,
    MoreVertical,
    Users,
    Loader2,
    X,
    Mic,
    Reply,
} from 'lucide-react'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { getLevelLabel } from '@/lib/services/users'

interface ChatViewProps {
    conversation: ConversationWithMembers
    messages: MessageWithSender[]
    typingUsers: UserBasic[]
    isUserOnline: (userId: string) => boolean
    onSendMessage: (content: string, replyToId?: string) => void
    onSendFile?: (file: File, replyToId?: string) => void | Promise<void>
    onBack?: () => void
    onTyping?: () => void
    isLoading?: boolean
    isSending?: boolean
}

export function ChatView({
    conversation,
    messages,
    typingUsers,
    isUserOnline,
    onSendMessage,
    onSendFile,
    onBack,
    onTyping,
    isLoading,
    isSending,
}: ChatViewProps) {
    const { profile } = useAuth()
    const [input, setInput] = useState('')
    const [selectedFile, setSelectedFile] = useState<File | null>(null)
    const [showVoiceRecorder, setShowVoiceRecorder] = useState(false)
    const [isSendingVoice, setIsSendingVoice] = useState(false)
    const [replyingTo, setReplyingTo] = useState<MessageWithSender | null>(null)
    const messagesEndRef = useRef<HTMLDivElement>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)
    const inputRef = useRef<HTMLInputElement>(null)

    // Scroll to bottom on new messages
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [messages])

    // Focus input when replying
    useEffect(() => {
        if (replyingTo) {
            inputRef.current?.focus()
        }
    }, [replyingTo])

    const handleSend = () => {
        if (!input.trim() && !selectedFile) return

        // Haptic feedback for sending message
        haptics.medium()

        const replyToId = replyingTo?.id

        if (selectedFile && onSendFile) {
            onSendFile(selectedFile, replyToId)
            setSelectedFile(null)
        }

        if (input.trim()) {
            onSendMessage(input.trim(), replyToId)
            setInput('')
        }

        setReplyingTo(null)
    }

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            handleSend()
        }
        if (e.key === 'Escape' && replyingTo) {
            setReplyingTo(null)
        }
    }

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setInput(e.target.value)
        onTyping?.()
    }

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (file) {
            setSelectedFile(file)
        }
        e.target.value = ''
    }

    const handleSendVoiceMessage = async (audioBlob: Blob) => {
        if (!profile?.id || !conversation?.id) return

        try {
            setIsSendingVoice(true)
            toast.loading('Uploading voice message...', { id: 'voice-upload' })

            const audioFile = new File([audioBlob], 'Voice Message.webm', {
                type: audioBlob.type || 'audio/webm'
            })

            if (onSendFile) {
                await onSendFile(audioFile, replyingTo?.id)
            }

            toast.success('Voice message sent', { id: 'voice-upload' })
            setShowVoiceRecorder(false)
            setReplyingTo(null)
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to send voice message'
            toast.error(message, { id: 'voice-upload' })
        } finally {
            setIsSendingVoice(false)
        }
    }

    const handleReply = useCallback((message: MessageWithSender) => {
        haptics.light()
        setReplyingTo(message)
    }, [])

    const onDrop = useCallback((acceptedFiles: File[]) => {
        if (acceptedFiles.length > 0) {
            setSelectedFile(acceptedFiles[0])
        }
    }, [])

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        maxSize: 10 * 1024 * 1024,
        multiple: false,
        noClick: true,
        noKeyboard: true,
    })

    const otherUser = conversation.members.find(m => m.id !== profile?.id)
    const displayName = conversation.is_group ? conversation.name : otherUser?.name || 'Unknown'
    const hasContent = input.trim().length > 0 || selectedFile !== null
    const showSendButton = hasContent || showVoiceRecorder

    const currentUser = profile ? {
        id: profile.id,
        name: profile.name,
        email: profile.email,
        level: profile.level
    } : null

    return (
        <div className="flex flex-col h-full bg-background">
            {/* Header */}
            <div className="flex items-center gap-3 p-4 border-b border-border bg-card">
                {onBack && (
                    <Button variant="ghost" size="icon" onClick={onBack} className="lg:hidden">
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                )}
                <div className="relative">
                    <Avatar className="h-10 w-10">
                        {(() => {
                            const avatarUrl = conversation.is_group ? conversation.avatar_url : otherUser?.avatar_url
                            return avatarUrl ? <AvatarImage src={avatarUrl} alt={displayName || 'Avatar'} /> : null
                        })()}
                        <AvatarFallback className="bg-primary text-primary-foreground">
                            {displayName?.charAt(0).toUpperCase() || '?'}
                        </AvatarFallback>
                    </Avatar>
                    {!conversation.is_group && otherUser && isUserOnline(otherUser.id) && (
                        <OnlineStatusBadge
                            isOnline={true}
                            size="md"
                            className="absolute bottom-0 right-0"
                        />
                    )}
                </div>
                <div className="flex-1">
                    <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-foreground">{displayName}</h3>
                        {!conversation.is_group && otherUser && (
                            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                                {getLevelLabel(otherUser.level)}
                            </Badge>
                        )}
                    </div>
                    {typingUsers.length > 0 ? (
                        <p className="text-xs text-primary">
                            {typingUsers.map(u => u.name).join(', ')} typing...
                        </p>
                    ) : conversation.is_group ? (
                        <p className="text-xs text-muted-foreground">
                            {conversation.members.length} members
                        </p>
                    ) : otherUser && isUserOnline(otherUser.id) ? (
                        <p className="text-xs text-green-600 dark:text-green-500 flex items-center gap-1.5">
                            <OnlineStatusDot isOnline={true} size="sm" />
                            Active now
                        </p>
                    ) : otherUser?.email ? (
                        <p className="text-xs text-muted-foreground">{otherUser.email}</p>
                    ) : null}
                </div>
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                            <MoreVertical className="h-5 w-5" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        {conversation.is_group && (
                            <DropdownMenuItem>
                                <Users className="mr-2 h-4 w-4" />
                                View members
                            </DropdownMenuItem>
                        )}
                        <DropdownMenuItem className="text-destructive">
                            Leave conversation
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>

            {/* Messages */}
            <div
                {...getRootProps()}
                className={cn(
                    'flex-1 overflow-y-auto p-4 space-y-2 relative',
                    isDragActive && 'bg-primary/5'
                )}
            >
                <input {...getInputProps()} />
                {isDragActive && (
                    <div className="absolute inset-0 flex items-center justify-center bg-primary/10 border-2 border-dashed border-primary z-10 pointer-events-none">
                        <div className="text-center">
                            <Paperclip className="h-12 w-12 mx-auto mb-2 text-primary" />
                            <p className="text-lg font-medium text-primary">Drop file to upload</p>
                            <p className="text-sm text-muted-foreground">Max 10MB</p>
                        </div>
                    </div>
                )}
                {isLoading ? (
                    <div className="flex items-center justify-center h-full">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    </div>
                ) : messages.length === 0 ? (
                    <div className="flex items-center justify-center h-full text-muted-foreground">
                        <p>No messages yet. Say hi!</p>
                    </div>
                ) : (
                    <>
                        {messages.map((message) => (
                            <MessageBubble
                                key={message.id}
                                message={message}
                                messages={messages}
                                conversation={conversation}
                                currentUserId={profile?.id || ''}
                                currentUser={currentUser}
                                isOwn={message.sender_id === profile?.id}
                                onReply={handleReply}
                            />
                        ))}
                        <TypingBubble typingUsers={typingUsers} />
                    </>
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Reply Preview */}
            {replyingTo && (
                <div className="px-4 py-3 border-t border-border bg-muted/50 flex items-center gap-3">
                    <div className="w-1 h-12 bg-primary rounded-full flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-primary">
                            Replying to {replyingTo.sender?.name || 'Unknown'}
                        </p>
                        <p className="text-sm text-muted-foreground truncate">
                            {replyingTo.content || (replyingTo.file_name ? `File: ${replyingTo.file_name}` : 'Message')}
                        </p>
                    </div>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-10 w-10 rounded-full touch-manipulation flex-shrink-0"
                        onClick={() => {
                            haptics.light()
                            setReplyingTo(null)
                        }}
                    >
                        <X className="h-5 w-5" />
                    </Button>
                </div>
            )}

            {/* Input */}
            {showVoiceRecorder ? (
                <VoiceRecorder
                    onSend={handleSendVoiceMessage}
                    onCancel={() => setShowVoiceRecorder(false)}
                    maxDuration={300}
                />
            ) : (
                <div className="p-3 sm:p-4 border-t border-border bg-card">
                    {selectedFile && (
                        <div className="mb-3">
                            <FilePreview
                                file={selectedFile}
                                onRemove={() => setSelectedFile(null)}
                            />
                        </div>
                    )}

                    <div className="flex items-center gap-2">
                        <input
                            type="file"
                            ref={fileInputRef}
                            onChange={handleFileSelect}
                            className="hidden"
                        />
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                                haptics.light()
                                fileInputRef.current?.click()
                            }}
                            title="Attach file"
                            disabled={isSending || isSendingVoice}
                            className="h-11 w-11 rounded-full touch-manipulation flex-shrink-0"
                        >
                            <Paperclip className="h-5 w-5" />
                        </Button>
                        <Input
                            ref={inputRef}
                            placeholder={replyingTo ? "Reply..." : selectedFile ? "Add a message (optional)..." : "Type a message..."}
                            value={input}
                            onChange={handleInputChange}
                            onKeyDown={handleKeyDown}
                            className="flex-1 h-11 rounded-full px-4 text-[16px]"
                            disabled={isSendingVoice}
                        />

                        {showSendButton ? (
                            <Button
                                onClick={handleSend}
                                disabled={(!input.trim() && !selectedFile) || isSending || isSendingVoice}
                                size="icon"
                                title="Send"
                                className="h-11 w-11 rounded-full touch-manipulation flex-shrink-0"
                            >
                                {isSending || isSendingVoice ? (
                                    <Loader2 className="h-5 w-5 animate-spin" />
                                ) : (
                                    <Send className="h-5 w-5" />
                                )}
                            </Button>
                        ) : (
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => {
                                    haptics.light()
                                    setShowVoiceRecorder(true)
                                }}
                                title="Record voice message"
                                disabled={isSending || isSendingVoice}
                                className="h-11 w-11 rounded-full touch-manipulation flex-shrink-0"
                            >
                                <Mic className="h-5 w-5" />
                            </Button>
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}

interface MessageBubbleProps {
    message: MessageWithSender
    messages: MessageWithSender[]
    conversation: ConversationWithMembers
    currentUserId: string
    currentUser: UserBasic | null
    isOwn: boolean
    onReply: (message: MessageWithSender) => void
}

function MessageBubble({
    message,
    messages,
    conversation,
    currentUserId,
    currentUser,
    isOwn,
    onReply,
}: MessageBubbleProps) {
    const [showReactions, setShowReactions] = useState(false)
    const [showMobileActions, setShowMobileActions] = useState(false)
    const longPressTimer = useRef<NodeJS.Timeout | null>(null)
    const setReaction = useSetReaction()
    const bubbleRef = useRef<HTMLDivElement>(null)

    const isVoiceMessage = message.file_type?.startsWith('audio/')
    const groupedReactions = groupReactions(message.reactions, currentUserId)
    const userCurrentEmoji = getUserReaction(message.reactions, currentUserId)

    // Find the replied-to message
    const replyToMessage = message.reply_to_id
        ? messages.find(m => m.id === message.reply_to_id)
        : null

    // Format timestamp for each message
    const timestamp = formatMessageTime(message.created_at)

    // Swipe to reply gesture
    const handleSwipeReply = useCallback(() => {
        haptics.medium()
        onReply(message)
    }, [message, onReply])

    const { ref: swipeRef, handlers: swipeHandlers } = useSwipeGesture({
        onSwipeRight: handleSwipeReply,
        threshold: 60,
    })

    const handleReaction = useCallback((emoji: string) => {
        if (!currentUser) return

        // Haptic feedback for reaction
        haptics.light()

        setReaction.mutate({
            messageId: message.id,
            conversationId: message.conversation_id,
            userId: currentUserId,
            emoji,
            user: currentUser,
            currentEmoji: userCurrentEmoji,
        })
        setShowReactions(false)
        setShowMobileActions(false)
    }, [currentUser, message.id, message.conversation_id, currentUserId, userCurrentEmoji, setReaction])

    const handleToggleReaction = useCallback((emoji: string) => {
        handleReaction(emoji)
    }, [handleReaction])

    // Touch handlers for long press (show mobile actions)
    const handleTouchStart = useCallback((e: React.TouchEvent) => {
        // Also trigger swipe start
        swipeHandlers.onTouchStart(e)

        longPressTimer.current = setTimeout(() => {
            // Haptic feedback for long press
            haptics.medium()
            setShowMobileActions(true)
        }, 400)
    }, [swipeHandlers])

    const handleTouchMove = useCallback((e: React.TouchEvent) => {
        swipeHandlers.onTouchMove(e)
        // Cancel long press if user starts moving
        if (longPressTimer.current) {
            clearTimeout(longPressTimer.current)
            longPressTimer.current = null
        }
    }, [swipeHandlers])

    const handleTouchEnd = useCallback(() => {
        swipeHandlers.onTouchEnd()
        if (longPressTimer.current) {
            clearTimeout(longPressTimer.current)
            longPressTimer.current = null
        }
    }, [swipeHandlers])

    // Close mobile actions and reactions on outside click
    useEffect(() => {
        if (!showReactions && !showMobileActions) return

        const handleClick = (e: MouseEvent) => {
            // Don't close if clicking inside the bubble
            if (bubbleRef.current?.contains(e.target as Node)) return
            setShowReactions(false)
            setShowMobileActions(false)
        }

        // Small delay to prevent immediate close on the triggering tap
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

    // For group chats, determine if we should show avatar (first message from this sender in a sequence)
    const isGroupChat = conversation.is_group
    const messageIndex = messages.findIndex(m => m.id === message.id)
    const prevMessage = messageIndex > 0 ? messages[messageIndex - 1] : null
    const showAvatar = isGroupChat && !isOwn && prevMessage?.sender_id !== message.sender_id
    const showSenderName = isGroupChat && !isOwn && prevMessage?.sender_id !== message.sender_id

    if (message.is_deleted) {
        return (
            <div className={cn('flex', isOwn ? 'justify-end' : 'justify-start')}>
                {/* Avatar placeholder for alignment in groups */}
                {isGroupChat && !isOwn && <div className="w-8 mr-2 flex-shrink-0" />}
                <div className="px-4 py-2 rounded-xl bg-muted/50 text-muted-foreground italic text-sm">
                    Message deleted
                </div>
            </div>
        )
    }

    return (
        <div className={cn('flex group', isOwn ? 'justify-end' : 'justify-start')}>
            {/* Avatar for group chats (other people's messages only) */}
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

            {/* Action buttons - visible on hover (desktop only) */}
            <div
                className={cn(
                    'hidden sm:flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity',
                    isOwn ? 'order-first mr-2' : 'order-last ml-2'
                )}
            >
                <button
                    onClick={() => setShowReactions(true)}
                    className="p-1.5 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                    title="React"
                >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                </button>
                <button
                    onClick={() => onReply(message)}
                    className="p-1.5 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                    title="Reply"
                >
                    <Reply className="w-4 h-4" />
                </button>
            </div>

            <div
                ref={(el) => {
                    bubbleRef.current = el
                    swipeRef.current = el
                }}
                className={cn(
                    'max-w-[80%] sm:max-w-[70%] relative select-none',
                    // Reduce max-width in groups to account for avatar
                    isGroupChat && !isOwn && 'max-w-[calc(80%-40px)] sm:max-w-[calc(70%-40px)]'
                )}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
                onTouchCancel={handleTouchEnd}
                onDoubleClick={() => {
                    haptics.light()
                    setShowReactions(true)
                }}
            >
                {/* Sender name for group chats */}
                {showSenderName && (
                    <p className="text-xs font-medium text-primary mb-1 ml-1">
                        {message.sender?.name || 'Unknown'}
                    </p>
                )}
                {/* Mobile Actions Popup (long press) */}
                {showMobileActions && (
                    <div
                        className={cn(
                            'absolute bottom-full mb-2 z-30 sm:hidden',
                            isOwn ? 'right-0' : 'left-0'
                        )}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <MobileMessageActions
                            onReact={() => {
                                setShowMobileActions(false)
                                setShowReactions(true)
                            }}
                            onCopy={() => setShowMobileActions(false)}
                            onClose={() => setShowMobileActions(false)}
                            messageContent={message.content || undefined}
                        />
                    </div>
                )}

                {/* Reaction picker popup */}
                {showReactions && (
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

                {/* Message bubble with reply inside (WhatsApp style) */}
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
                                    <MessageStatus
                                        message={message}
                                        conversation={conversation}
                                        currentUserId={currentUserId}
                                    />
                                </div>
                            </div>
                        )}
                        {/* Timestamp for file-only messages */}
                        {!message.content && (
                            <div className={cn('flex items-center gap-1', isOwn && 'justify-end')}>
                                <span className="text-[10px] text-muted-foreground">{timestamp}</span>
                                <MessageStatus
                                    message={message}
                                    conversation={conversation}
                                    currentUserId={currentUserId}
                                />
                            </div>
                        )}
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
                        {/* Reply reference inside bubble */}
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
                                <MessageStatus
                                    message={message}
                                    conversation={conversation}
                                    currentUserId={currentUserId}
                                />
                            </div>
                        </div>
                    </div>
                )}

                {/* Reaction badges */}
                {groupedReactions.length > 0 && (
                    <ReactionBadges
                        reactions={groupedReactions}
                        onToggle={handleToggleReaction}
                        isOwn={isOwn}
                    />
                )}
            </div>
        </div>
    )
}
