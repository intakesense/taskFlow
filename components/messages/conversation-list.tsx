'use client'

import { useState } from 'react'
import { useAuth } from '@/lib/auth-context'
import { ConversationWithMembers } from '@/lib/types'
import { cn } from '@/lib/utils'
import { useUpdatingTimestamp } from '@/hooks/use-updating-timestamp'
import { useOnlinePresence } from '@/hooks/use-online-presence'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { OnlineStatusBadge } from './online-status-badge'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Search, Plus, Users, MessageSquare } from 'lucide-react'

interface ConversationListProps {
    conversations: ConversationWithMembers[]
    selectedId?: string
    onSelect: (conversation: ConversationWithMembers) => void
    onSelectUser: (userId: string) => void
    onNewChat?: () => void
    isLoading?: boolean
    isCreatingConversation?: boolean
}

export function ConversationList({
    conversations,
    selectedId,
    onSelect,
    onNewChat,
    isLoading,
}: ConversationListProps) {
    const { profile } = useAuth()
    const [search, setSearch] = useState('')

    // Track online presence for selected conversation
    const { isUserOnline } = useOnlinePresence(selectedId, profile?.id, !!selectedId)

    // Filter conversations by search
    const filteredConversations = conversations.filter((conv) => {
        if (!search) return true
        const name = getConversationName(conv, profile?.id)
        return name.toLowerCase().includes(search.toLowerCase())
    })

    return (
        <div className="flex flex-col h-full bg-card">
            {/* Header */}
            <div className="p-4 border-b border-border">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-bold text-foreground">Messages</h2>
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
                    <div className="p-4 text-center text-muted-foreground">Loading...</div>
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
                    filteredConversations.map((conv) => (
                        <ConversationItem
                            key={conv.id}
                            conversation={conv}
                            currentUserId={profile?.id}
                            isSelected={selectedId === conv.id}
                            onClick={() => onSelect(conv)}
                            isUserOnline={isUserOnline}
                        />
                    ))
                )}
            </div>
        </div>
    )
}

interface ConversationItemProps {
    conversation: ConversationWithMembers
    currentUserId?: string
    isSelected: boolean
    onClick: () => void
    isUserOnline: (userId: string) => boolean
}

function ConversationItem({ conversation, currentUserId, isSelected, onClick, isUserOnline }: ConversationItemProps) {
    const name = getConversationName(conversation, currentUserId)
    const avatar = getConversationAvatar(conversation, currentUserId)
    const lastMessage = conversation.lastMessage
    const unread = conversation.unreadCount || 0

    // Use reactive timestamp that updates automatically
    const timestamp = useUpdatingTimestamp(lastMessage?.created_at, 'message')

    // Get the other user for DM conversations (to show online status)
    const otherUser = !conversation.is_group
      ? conversation.members.find((m) => m.id !== currentUserId)
      : null
    const showOnlineStatus = otherUser && isUserOnline(otherUser.id)

    return (
        <button
            onClick={onClick}
            className={cn(
                'w-full flex items-center gap-3 p-4 transition-all text-left border-l-2',
                'hover:bg-accent/50 active:bg-accent',
                isSelected
                    ? 'bg-accent border-l-primary'
                    : 'border-l-transparent'
            )}
        >
            <div className="relative">
                <Avatar className="h-12 w-12 flex-shrink-0">
                    <AvatarFallback className={cn(
                        isSelected
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted text-muted-foreground'
                    )}>
                        {avatar}
                    </AvatarFallback>
                </Avatar>
                {/* Show online status badge for DM conversations */}
                {showOnlineStatus && (
                    <OnlineStatusBadge
                        isOnline={true}
                        size="md"
                        className="absolute bottom-0 right-0"
                    />
                )}
            </div>

            <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                    <span className={cn(
                        'font-medium truncate',
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
                    {unread > 0 && (
                        <Badge className="ml-2 bg-primary text-primary-foreground flex-shrink-0 min-w-[20px] justify-center">
                            {unread > 99 ? '99+' : unread}
                        </Badge>
                    )}
                </div>
            </div>

            {conversation.is_group && (
                <Users className={cn(
                    'h-4 w-4 flex-shrink-0',
                    isSelected ? 'text-primary' : 'text-muted-foreground'
                )} />
            )}
        </button>
    )
}

// Helper functions
function getConversationName(conv: ConversationWithMembers, currentUserId?: string): string {
    if (conv.is_group && conv.name) return conv.name
    // For DMs, show the other person's name
    const other = conv.members.find(m => m.id !== currentUserId)
    return other?.name || 'Unknown'
}

function getConversationAvatar(conv: ConversationWithMembers, currentUserId?: string): string {
    if (conv.is_group) return conv.name?.charAt(0).toUpperCase() || 'G'
    const other = conv.members.find(m => m.id !== currentUserId)
    return other?.name?.charAt(0).toUpperCase() || '?'
}
