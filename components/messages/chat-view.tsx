'use client'

import { useState, useRef, useEffect } from 'react'
import { useAuth } from '@/lib/auth-context'
import { ConversationWithMembers, MessageWithSender, UserBasic } from '@/lib/types'
import { cn } from '@/lib/utils'
import { formatMessageTime } from '@/lib/utils/date'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { FileAttachment } from './file-attachment'
import {
    ArrowLeft,
    Send,
    Paperclip,
    MoreVertical,
    Check,
    CheckCheck,
    Users,
    Loader2,
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
    onSendMessage: (content: string) => void
    onSendFile?: (file: File) => void
    onBack?: () => void
    onTyping?: () => void
    isLoading?: boolean
    isSending?: boolean
}

export function ChatView({
    conversation,
    messages,
    typingUsers,
    onSendMessage,
    onSendFile,
    onBack,
    onTyping,
    isLoading,
    isSending,
}: ChatViewProps) {
    const { profile } = useAuth()
    const [input, setInput] = useState('')
    const messagesEndRef = useRef<HTMLDivElement>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)

    // Scroll to bottom on new messages
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [messages])

    const handleSend = () => {
        if (!input.trim()) return
        onSendMessage(input.trim())
        setInput('')
    }

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            handleSend()
        }
    }

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setInput(e.target.value)
        onTyping?.()
    }

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (file && onSendFile) {
            onSendFile(file)
        }
        e.target.value = ''
    }

    const otherUser = conversation.members.find(m => m.id !== profile?.id)
    const displayName = conversation.is_group ? conversation.name : otherUser?.name || 'Unknown'

    return (
        <div className="flex flex-col h-full bg-background">
            {/* Header */}
            <div className="flex items-center gap-3 p-4 border-b border-border bg-card">
                {onBack && (
                    <Button variant="ghost" size="icon" onClick={onBack} className="lg:hidden">
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                )}
                <Avatar className="h-10 w-10">
                    <AvatarFallback className="bg-primary text-primary-foreground">
                        {displayName?.charAt(0).toUpperCase() || '?'}
                    </AvatarFallback>
                </Avatar>
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
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {isLoading ? (
                    <div className="flex items-center justify-center h-full">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    </div>
                ) : messages.length === 0 ? (
                    <div className="flex items-center justify-center h-full text-muted-foreground">
                        <p>No messages yet. Say hi!</p>
                    </div>
                ) : (
                    messages.map((message, index) => (
                        <MessageBubble
                            key={message.id}
                            message={message}
                            isOwn={message.sender_id === profile?.id}
                            showAvatar={
                                conversation.is_group &&
                                message.sender_id !== profile?.id &&
                                (index === 0 || messages[index - 1].sender_id !== message.sender_id)
                            }
                        />
                    ))
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="p-4 border-t border-border bg-card">
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
                        onClick={() => fileInputRef.current?.click()}
                    >
                        <Paperclip className="h-5 w-5" />
                    </Button>
                    <Input
                        placeholder="Type a message..."
                        value={input}
                        onChange={handleInputChange}
                        onKeyDown={handleKeyDown}
                        className="flex-1"
                    />
                    <Button
                        onClick={handleSend}
                        disabled={!input.trim() || isSending}
                        size="icon"
                    >
                        {isSending ? (
                            <Loader2 className="h-5 w-5 animate-spin" />
                        ) : (
                            <Send className="h-5 w-5" />
                        )}
                    </Button>
                </div>
            </div>
        </div>
    )
}

interface MessageBubbleProps {
    message: MessageWithSender
    isOwn: boolean
    showAvatar?: boolean
}

function MessageBubble({ message, isOwn, showAvatar }: MessageBubbleProps) {
    if (message.is_deleted) {
        return (
            <div className={cn('flex', isOwn ? 'justify-end' : 'justify-start')}>
                <div className="px-4 py-2 rounded-xl bg-muted/50 text-muted-foreground italic text-sm">
                    Message deleted
                </div>
            </div>
        )
    }

    return (
        <div className={cn('flex gap-2', isOwn ? 'justify-end' : 'justify-start')}>
            {!isOwn && showAvatar && (
                <Avatar className="h-8 w-8 flex-shrink-0">
                    <AvatarFallback className="bg-primary/20 text-primary text-xs">
                        {message.sender?.name?.charAt(0).toUpperCase() || '?'}
                    </AvatarFallback>
                </Avatar>
            )}
            {!isOwn && !showAvatar && <div className="w-8" />}

            <div className={cn('max-w-[70%]', isOwn && 'text-right')}>
                {!isOwn && showAvatar && (
                    <p className="text-xs text-muted-foreground mb-1">{message.sender?.name}</p>
                )}

                {message.file_url ? (
                    <div className="space-y-2">
                        <FileAttachment
                            fileUrl={message.file_url}
                            fileName={message.file_name || 'File'}
                            fileType={message.file_type || 'application/octet-stream'}
                            fileSize={message.file_size || undefined}
                        />
                        {message.content && (
                            <div
                                className={cn(
                                    'rounded-2xl px-4 py-2 inline-block',
                                    isOwn
                                        ? 'bg-primary text-primary-foreground rounded-br-sm'
                                        : 'bg-muted text-foreground rounded-bl-sm'
                                )}
                            >
                                <p className="text-sm whitespace-pre-wrap break-words">{message.content}</p>
                            </div>
                        )}
                    </div>
                ) : (
                    <div
                        className={cn(
                            'rounded-2xl px-4 py-2 inline-block',
                            isOwn
                                ? 'bg-primary text-primary-foreground rounded-br-sm'
                                : 'bg-muted text-foreground rounded-bl-sm'
                        )}
                    >
                        <p className="text-sm whitespace-pre-wrap break-words">{message.content}</p>
                    </div>
                )}

                <div className={cn('flex items-center gap-1 mt-1', isOwn && 'justify-end')}>
                    <span className="text-xs text-muted-foreground">
                        {formatMessageTime(message.created_at)}
                    </span>
                    {isOwn && (
                        <CheckCheck className="h-3 w-3 text-primary" />
                    )}
                </div>
            </div>
        </div>
    )
}

