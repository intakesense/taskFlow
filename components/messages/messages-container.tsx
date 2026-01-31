'use client'

import { useState, useEffect, useCallback, useRef, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useAuth } from '@/lib/auth-context'
import {
  useConversations,
  useConversationsRealtime,
  useChatMessages,
  useConversationRealtime,
  useSendChatMessage,
  useCreateDM,
  useCreateGroup,
  useSetTyping,
  useMarkAsRead,
  useMobile,
  useBackNavigation,
  chatMessageKeys,
  fetchMessages,
} from '@/hooks'
import { ConversationWithMembers } from '@/lib/types'
import { uploadFile } from '@/lib/services/file-upload'
import { MessagesView } from './messages-view'
import { DashboardLayout } from '@/components/layout'

interface MessagesContainerProps {
  initialConversations?: ConversationWithMembers[]
}

export function MessagesContainer({ initialConversations }: MessagesContainerProps) {
  const router = useRouter()
  const { user, profile } = useAuth()
  const [selectedConversation, setSelectedConversation] = useState<ConversationWithMembers | null>(null)
  const [showNewChat, setShowNewChat] = useState(false)
  const isMobileView = useMobile()

  // useTransition for non-blocking conversation switching
  const [isPending, startTransition] = useTransition()

  // Handle browser back button - returns to conversation list instead of leaving app
  const handleBackToList = useCallback(() => {
    setSelectedConversation(null)
  }, [])

  useBackNavigation(
    !!selectedConversation && isMobileView,
    handleBackToList,
    isMobileView
  )

  // NOTE: Server handles auth redirect in page.tsx, no need for client-side check

  // Hooks - pass initialData from server for instant first paint
  const queryClient = useQueryClient()
  const { data: conversations = [], isLoading: loadingConversations } = useConversations(
    profile?.id,
    { initialData: initialConversations }
  )
  useConversationsRealtime(profile?.id)

  // AGGRESSIVE PREFETCHING: Preload ALL conversation messages on mount
  // Since we only have ~20 employees, this is fast and makes switching instant
  useEffect(() => {
    if (conversations.length === 0) return

    conversations.forEach(conv => {
      queryClient.prefetchQuery({
        queryKey: chatMessageKeys.conversation(conv.id),
        queryFn: () => fetchMessages(conv.id),
        staleTime: 60_000, // Consider fresh for 1 minute
      })
    })
  }, [conversations, queryClient])

  const { data: messages = [], isLoading: loadingMessages } = useChatMessages(selectedConversation?.id)

  const sendMessage = useSendChatMessage()
  const createDM = useCreateDM()
  const createGroup = useCreateGroup()
  const markAsRead = useMarkAsRead()
  const { setTyping, clearTyping } = useSetTyping()

  // Debounced mark as read - prevents rapid-fire DB writes when multiple messages arrive
  const markAsReadTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const lastMarkedConversationRef = useRef<string | null>(null)

  const debouncedMarkAsRead = useCallback((conversationId: string, userId: string) => {
    // Clear any pending timeout
    if (markAsReadTimeoutRef.current) {
      clearTimeout(markAsReadTimeoutRef.current)
    }

    // Debounce: wait 300ms before actually marking as read
    // This batches multiple rapid messages into a single DB write
    markAsReadTimeoutRef.current = setTimeout(() => {
      markAsRead.mutate({ conversationId, userId })
      lastMarkedConversationRef.current = conversationId
      markAsReadTimeoutRef.current = null
    }, 300)
  }, [markAsRead])

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (markAsReadTimeoutRef.current) {
        clearTimeout(markAsReadTimeoutRef.current)
      }
    }
  }, [])

  // Callback when new messages arrive while chat is open
  const handleNewMessageArrived = useCallback((message: { sender_id: string }) => {
    // Only mark as read if message is from someone else
    if (selectedConversation?.id && profile?.id && message.sender_id !== profile.id) {
      debouncedMarkAsRead(selectedConversation.id, profile.id)
    }
  }, [selectedConversation?.id, profile?.id, debouncedMarkAsRead])

  // CONSOLIDATED: Single hook for messages + typing + online status
  const { typingUsers, isUserOnline } = useConversationRealtime(
    selectedConversation?.id,
    profile?.id,
    handleNewMessageArrived
  )

  // Mark as read when opening a conversation (immediate, not debounced)
  useEffect(() => {
    if (selectedConversation?.id && profile?.id) {
      // Skip if we just marked this conversation as read via the debounced handler
      if (lastMarkedConversationRef.current === selectedConversation.id) {
        lastMarkedConversationRef.current = null
        return
      }
      markAsRead.mutate({
        conversationId: selectedConversation.id,
        userId: profile.id,
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedConversation?.id, profile?.id])

  // Handlers - use startTransition for non-blocking conversation switching
  const handleSelectConversation = (conv: ConversationWithMembers) => {
    startTransition(() => {
      setSelectedConversation(conv)
    })
  }

  const handleSendMessage = (content: string, replyToId?: string) => {
    if (!selectedConversation || !profile?.id) return

    sendMessage.mutate({
      conversationId: selectedConversation.id,
      senderId: profile.id,
      content,
      replyToId,
    }, {
      onError: (error) => {
        console.error('Failed to send message:', error)
        const message = error instanceof Error ? error.message : 'Failed to send message'
        toast.error(message)
      },
    })

    // Clear typing indicator (preserves online status)
    clearTyping(selectedConversation.id, profile.id)
  }

  const handleTyping = () => {
    if (!selectedConversation || !profile?.id || !profile) return
    // Pass full user object for Presence
    setTyping(selectedConversation.id, profile.id, {
      id: profile.id,
      name: profile.name,
      email: profile.email,
      level: profile.level,
    })
  }

  const handleSendFile = async (file: File, replyToId?: string) => {
    if (!selectedConversation || !profile?.id) return

    try {
      toast.loading('Uploading file...', { id: 'file-upload' })

      // Upload file to storage
      const uploadedFile = await uploadFile(file, profile.id)

      // Send message with file attachment
      await sendMessage.mutateAsync({
        conversationId: selectedConversation.id,
        senderId: profile.id,
        fileUrl: uploadedFile.url,
        fileName: file.name,
        fileSize: uploadedFile.size,
        fileType: uploadedFile.type,
        replyToId,
      })

      toast.success('File uploaded successfully', { id: 'file-upload' })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to upload file'
      toast.error(message, { id: 'file-upload' })
    }
  }

  const handleCreateDM = async (userId: string) => {
    if (!profile?.id) return
    try {
      const conv = await createDM.mutateAsync({ userId: profile.id, otherUserId: userId })
      setShowNewChat(false)
      toast.success('Conversation started')

      // Wait a moment for the query to refetch, then select the conversation
      setTimeout(() => {
        const enriched = conversations.find(c => c.id === conv.id)
        if (enriched) {
          setSelectedConversation(enriched)
        }
      }, 100)
    } catch (error) {
      console.error('DM creation error:', error)
      const message = error instanceof Error ? error.message : 'Failed to create conversation'
      toast.error(`Failed to create conversation: ${message}`)
    }
  }

  const handleCreateGroup = async (name: string, memberIds: string[]) => {
    if (!profile?.id) return
    try {
      const conv = await createGroup.mutateAsync({
        userId: profile.id,
        input: { name, memberIds },
      })
      setShowNewChat(false)
      toast.success(`Group "${name}" created`)

      // Wait a moment for the query to refetch, then select the conversation
      setTimeout(() => {
        const enriched = conversations.find(c => c.id === conv.id)
        if (enriched) {
          setSelectedConversation(enriched)
        }
      }, 100)
    } catch (error) {
      console.error('Group creation error:', error)
      const message = error instanceof Error ? error.message : 'Failed to create group'
      toast.error(`Failed to create group: ${message}`)
    }
  }

  // Server already handles auth redirect in page.tsx, so we can skip the loading spinner
  // The user state will be available immediately after initial render
  if (!user) {
    return null // Redirecting...
  }

  return (
    <DashboardLayout>
      <MessagesView
        conversations={conversations}
        selectedConversation={selectedConversation}
        messages={messages}
        typingUsers={typingUsers}
        isUserOnline={isUserOnline}
        isMobileView={isMobileView}
        showNewChat={showNewChat}
        loadingConversations={loadingConversations}
        loadingMessages={loadingMessages}
        sendingMessage={sendMessage.isPending}
        creatingConversation={createDM.isPending || createGroup.isPending}
        isPending={isPending}
        onSelectConversation={handleSelectConversation}
        onSendMessage={handleSendMessage}
        onSendFile={handleSendFile}
        onTyping={handleTyping}
        onCreateDM={handleCreateDM}
        onCreateGroup={handleCreateGroup}
        onBackToList={handleBackToList}
        onNewChat={() => setShowNewChat(true)}
        onCloseNewChat={() => setShowNewChat(false)}
      />
    </DashboardLayout>
  )
}
