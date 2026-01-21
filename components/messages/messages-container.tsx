'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { useAuth } from '@/lib/auth-context'
import {
  useConversations,
  useConversationsRealtime,
  useChatMessages,
  useMessagesRealtime,
  useSendChatMessage,
  useCreateDM,
  useCreateGroup,
  useTypingIndicator,
  useSetTyping,
  useMarkAsRead,
  useMobile,
} from '@/hooks'
import { ConversationWithMembers } from '@/lib/types'
import { uploadFile } from '@/lib/services/file-upload'
import { MessagesView } from './messages-view'
import { DashboardLayout } from '@/components/layout'
import { Loader2 } from 'lucide-react'

export function MessagesContainer() {
  const router = useRouter()
  const { user, profile, loading: authLoading } = useAuth()
  const [selectedConversation, setSelectedConversation] = useState<ConversationWithMembers | null>(null)
  const [showNewChat, setShowNewChat] = useState(false)
  const isMobileView = useMobile()

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login')
    }
  }, [authLoading, user, router])

  // Hooks
  const { data: conversations = [], isLoading: loadingConversations } = useConversations(profile?.id)
  useConversationsRealtime(profile?.id)

  const { data: messages = [], isLoading: loadingMessages } = useChatMessages(selectedConversation?.id)
  useMessagesRealtime(selectedConversation?.id)

  const sendMessage = useSendChatMessage()
  const createDM = useCreateDM()
  const createGroup = useCreateGroup()
  const markAsRead = useMarkAsRead()
  const typingUsers = useTypingIndicator(selectedConversation?.id)
  const { setTyping, clearTyping } = useSetTyping()

  // Mark as read when opening a conversation
  useEffect(() => {
    if (selectedConversation && profile?.id) {
      markAsRead.mutate({
        conversationId: selectedConversation.id,
        userId: profile.id,
      })
    }
  }, [selectedConversation?.id, profile?.id, markAsRead])

  // Handlers
  const handleSelectConversation = (conv: ConversationWithMembers) => {
    setSelectedConversation(conv)
  }

  const handleSendMessage = (content: string) => {
    if (!selectedConversation || !profile?.id) return

    sendMessage.mutate({
      conversationId: selectedConversation.id,
      senderId: profile.id,
      content,
    })

    clearTyping(selectedConversation.id, profile.id)
  }

  const handleTyping = () => {
    if (!selectedConversation || !profile?.id) return
    setTyping(selectedConversation.id, profile.id)
  }

  const handleSendFile = async (file: File) => {
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
      toast.error('Failed to create conversation')
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
      toast.error('Failed to create group')
    }
  }

  const handleBackToList = () => {
    setSelectedConversation(null)
  }

  // Loading state
  if (authLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-96">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    )
  }

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
        isMobileView={isMobileView}
        showNewChat={showNewChat}
        loadingConversations={loadingConversations}
        loadingMessages={loadingMessages}
        sendingMessage={sendMessage.isPending}
        creatingConversation={createDM.isPending || createGroup.isPending}
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
