'use client'

import { useState, useEffect, useRef } from 'react'
import { m, AnimatePresence, useReducedMotion } from 'framer-motion'
import { useAuth } from '@/lib/auth-context'
import { ConversationWithMembers } from '@/lib/types'
import { cn } from '@/lib/utils'
import { useFormattedTimestamp } from '@/lib/global-clock'
import { listContainerVariants, listItemVariants, badgeVariants, springs } from '@/lib/animations'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Search, Plus, Users, MessageSquare, ListTodo } from 'lucide-react'
import { haptics } from '@/lib/haptics'
import { ProfilePictureDialog } from './profile-picture-dialog'

interface ConversationListProps {
    conversations: ConversationWithMembers[]
    selectedId?: string
    onSelect: (conversation: ConversationWithMembers) => void
    onSelectUser: (userId: string) => void
    onNewChat?: () => void
    isLoading?: boolean
    isCreatingConversation?: boolean
    isPending?: boolean // From useTransition
}

export function ConversationList({
    conversations,
    selectedId,
    onSelect,
    onNewChat,
    isLoading,
    isPending,
}: ConversationListProps) {
    const { effectiveUser } = useAuth()
    const [search, setSearch] = useState('')
    const [showProfilePicture, setShowProfilePicture] = useState(false)
    const [selectedProfile, setSelectedProfile] = useState<{
        avatarUrl?: string | null
        name: string
        email?: string | null
    } | null>(null)

    // Filter conversations by search
    const filteredConversations = conversations.filter((conv) => {
        if (!search) return true
        const name = getConversationName(conv, effectiveUser?.id)
        return name.toLowerCase().includes(search.toLowerCase())
    })

    return (
        <div className={cn(
            "flex flex-col h-full bg-card transition-opacity duration-150",
            isPending && "opacity-70"
        )}>
            {/* Header */}
            <div className="p-4 border-b border-border">
                <div className="flex items-center justify-between mb-4">
                    {/* Mobile: TaskFlow branding, Desktop: Messages heading */}
                    <div className="flex items-center gap-3">
                        {/* Logo - mobile only */}
                        <div className="lg:hidden w-10 h-10 bg-primary rounded-xl flex items-center justify-center">
                            <ListTodo className="w-5 h-5 text-primary-foreground" />
                        </div>
                        <div>
                            {/* TaskFlow - mobile only */}
                            <h1 className="lg:hidden text-lg font-bold text-foreground">TaskFlow</h1>
                            {/* Messages - desktop only */}
                            <h2 className="hidden lg:block text-xl font-bold text-foreground">Messages</h2>
                            {/* Subtitle - mobile only */}
                            <p className="lg:hidden text-xs text-muted-foreground">Messages</p>
                        </div>
                    </div>
                    <Button size="icon" variant="ghost" onClick={onNewChat}>
                        <Plus className="h-5 w-5" />
                    </Button>
                </div>
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search conversations..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="pl-9"
                    />
                </div>
            </div>

            {/* Conversation List */}
            <div className="flex-1 overflow-y-auto">
                {isLoading ? (
                    <ConversationListSkeleton />
                ) : filteredConversations.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full p-8 text-center">
                        <MessageSquare className="h-12 w-12 text-muted-foreground/50 mb-4" />
                        <p className="text-muted-foreground mb-2">
                            {search ? 'No conversations found' : 'No conversations yet'}
                        </p>
                        {!search && (
                            <Button variant="outline" size="sm" onClick={onNewChat} className="mt-2">
                                <Plus className="h-4 w-4 mr-2" />
                                Start a conversation
                            </Button>
                        )}
                    </div>
                ) : (
                    <m.div
                        variants={listContainerVariants}
                        initial="initial"
                        animate="animate"
                    >
                        <AnimatePresence mode="popLayout">
                            {filteredConversations.map((conv) => (
                                <ConversationItem
                                    key={conv.id}
                                    conversation={conv}
                                    currentUserId={effectiveUser?.id}
                                    isSelected={selectedId === conv.id}
                                    onClick={() => onSelect(conv)}
                                    onAvatarClick={(avatarUrl, name, email) => {
                                        setSelectedProfile({ avatarUrl, name, email })
                                        setShowProfilePicture(true)
                                    }}
                                />
                            ))}
                        </AnimatePresence>
                    </m.div>
                )}
            </div>

            {/* Profile Picture Dialog */}
            {selectedProfile && (
                <ProfilePictureDialog
                    open={showProfilePicture}
                    onOpenChange={(open) => {
                        setShowProfilePicture(open)
                        if (!open) {
                            setTimeout(() => setSelectedProfile(null), 200)
                        }
                    }}
                    avatarUrl={selectedProfile.avatarUrl}
                    name={selectedProfile.name}
                    email={selectedProfile.email}
                />
            )}
        </div>
    )
}

interface ConversationItemProps {
    conversation: ConversationWithMembers
    currentUserId?: string
    isSelected: boolean
    onClick: () => void
    onAvatarClick?: (avatarUrl: string | null | undefined, name: string, email: string | null | undefined) => void
}

function ConversationItem({ conversation, currentUserId, isSelected, onClick, onAvatarClick }: Omit<ConversationItemProps, 'index'>) {
    const name = getConversationName(conversation, currentUserId)
    const { initials, imageUrl } = getConversationAvatar(conversation, currentUserId)
    const lastMessage = conversation.lastMessage
    const unread = conversation.unreadCount || 0
    const prevUnreadRef = useRef(unread)
    const prefersReducedMotion = useReducedMotion()
    const [shouldPulse, setShouldPulse] = useState(false)

    // Track if unread increased for pulse animation
    // Using flushSync-free pattern: schedule state update via microtask
    useEffect(() => {
        if (unread > prevUnreadRef.current) {
            // Schedule state update to avoid synchronous setState in effect
            queueMicrotask(() => setShouldPulse(true))
            const timeout = setTimeout(() => setShouldPulse(false), 300)
            prevUnreadRef.current = unread
            return () => clearTimeout(timeout)
        }
        prevUnreadRef.current = unread
    }, [unread])

    // Use reactive timestamp from global clock (single interval for all timestamps)
    const timestamp = useFormattedTimestamp(lastMessage?.created_at, 'message')

    const handleClick = () => {
        haptics.selection()
        onClick()
    }

    const handleAvatarClick = (e: React.MouseEvent) => {
        e.stopPropagation() // Prevent conversation selection
        haptics.light()

        // Get conversation details for profile viewing
        const otherUser = conversation.members.find(m => m.id !== currentUserId)
        const isSelfChat = !otherUser && conversation.members.length === 1 && conversation.members[0]?.id === currentUserId
        const self = conversation.members[0]

        if (conversation.is_group) {
            onAvatarClick?.(conversation.avatar_url, conversation.name || 'Group', undefined)
        } else if (isSelfChat && self) {
            onAvatarClick?.(self.avatar_url, self.name, self.email)
        } else if (otherUser) {
            onAvatarClick?.(otherUser.avatar_url, otherUser.name, otherUser.email)
        }
    }

    return (
        <m.button
            layout
            variants={prefersReducedMotion ? undefined : listItemVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            whileHover={prefersReducedMotion ? undefined : { x: 4 }}
            whileTap={prefersReducedMotion ? undefined : { scale: 0.99 }}
            transition={springs.fast}
            onClick={handleClick}
            className={cn(
                'w-full flex items-center gap-3 p-4 transition-colors text-left border-l-2',
                'hover:bg-accent/50',
                'touch-manipulation min-h-[72px]',
                isSelected
                    ? 'bg-accent border-l-primary'
                    : 'border-l-transparent'
            )}
        >
            <div onClick={handleAvatarClick} className="cursor-pointer">
                <Avatar className="h-13 w-13 flex-shrink-0">
                    {imageUrl && <AvatarImage src={imageUrl} alt={name} />}
                    <AvatarFallback className={cn(
                        'text-base font-medium',
                        isSelected
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted text-muted-foreground'
                    )}>
                        {initials}
                    </AvatarFallback>
                </Avatar>
            </div>

            <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                    <span className={cn(
                        'font-semibold truncate text-[15px]',
                        isSelected ? 'text-foreground' : 'text-foreground'
                    )}>
                        {name}
                    </span>
                    {lastMessage && (
                        <span className={cn(
                            'text-xs flex-shrink-0 ml-2',
                            isSelected ? 'text-primary' : 'text-muted-foreground'
                        )}>
                            {timestamp}
                        </span>
                    )}
                </div>
                <div className="flex items-center justify-between gap-2">
                    <p className={cn(
                        'text-sm truncate',
                        unread > 0 ? 'text-foreground font-medium' : 'text-muted-foreground'
                    )}>
                        {lastMessage?.content || (lastMessage?.file_name ? '📎 ' + lastMessage.file_name : 'No messages yet')}
                    </p>
                    <AnimatePresence mode="wait">
                        {unread > 0 && (
                            <m.div
                                key="badge"
                                variants={prefersReducedMotion ? undefined : badgeVariants}
                                initial="initial"
                                animate={shouldPulse ? "pulse" : "animate"}
                                exit="exit"
                            >
                                <Badge className="ml-2 bg-primary text-primary-foreground flex-shrink-0 min-w-[22px] h-[22px] justify-center text-xs font-semibold">
                                    {unread > 99 ? '99+' : unread}
                                </Badge>
                            </m.div>
                        )}
                    </AnimatePresence>
                </div>
            </div>

            {conversation.is_group && (
                <Users className={cn(
                    'h-4 w-4 flex-shrink-0',
                    isSelected ? 'text-primary' : 'text-muted-foreground'
                )} />
            )}
        </m.button>
    )
}

// Helper functions
function getConversationName(conv: ConversationWithMembers, currentUserId?: string): string {
    if (conv.is_group && conv.name) return conv.name
    // For DMs, show the other person's name
    const other = conv.members.find(m => m.id !== currentUserId)
    // Self-chat: only member is yourself
    if (!other && conv.members.length === 1 && conv.members[0].id === currentUserId) {
        return 'You (Notes)' // WhatsApp-style self-chat name
    }
    return other?.name || 'Unknown'
}

function getConversationAvatar(conv: ConversationWithMembers, currentUserId?: string): { initials: string; imageUrl?: string } {
    if (conv.is_group) {
        return {
            initials: conv.name?.charAt(0).toUpperCase() || 'G',
            imageUrl: conv.avatar_url || undefined,
        }
    }
    const other = conv.members.find(m => m.id !== currentUserId)
    // Self-chat: use your own avatar
    if (!other && conv.members.length === 1 && conv.members[0].id === currentUserId) {
        const self = conv.members[0]
        return {
            initials: self?.name?.charAt(0).toUpperCase() || '?',
            imageUrl: self?.avatar_url || undefined,
        }
    }
    return {
        initials: other?.name?.charAt(0).toUpperCase() || '?',
        imageUrl: other?.avatar_url || undefined,
    }
}

// Skeleton for loading state - matches conversation item layout
function ConversationListSkeleton() {
    return (
        <div className="p-2 space-y-1">
            {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 p-4">
                    <Skeleton className="h-13 w-13 rounded-full shrink-0" />
                    <div className="flex-1 min-w-0 space-y-2">
                        <div className="flex items-center justify-between gap-2">
                            <Skeleton className="h-4 w-28" />
                            <Skeleton className="h-3 w-12" />
                        </div>
                        <Skeleton className="h-3 w-40" />
                    </div>
                </div>
            ))}
        </div>
    )
}
