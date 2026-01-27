// Messages View - Pure presentational component
import { ConversationWithMembers, MessageWithSender, UserBasic } from '@/lib/types'
import { ConversationList } from './conversation-list'
import { ChatView } from './chat-view'
import { NewChatDialog } from './new-chat-dialog'
import { MessageCircle } from 'lucide-react'

interface MessagesViewProps {
  conversations: ConversationWithMembers[]
  selectedConversation: ConversationWithMembers | null
  messages: MessageWithSender[]
  typingUsers: UserBasic[]
  isUserOnline: (userId: string) => boolean
  isMobileView: boolean
  showNewChat: boolean
  loadingConversations: boolean
  loadingMessages: boolean
  sendingMessage: boolean
  creatingConversation: boolean
  isPending?: boolean // From useTransition for non-blocking UI
  onSelectConversation: (conv: ConversationWithMembers) => void
  onSendMessage: (content: string, replyToId?: string) => void
  onSendFile?: (file: File, replyToId?: string) => void
  onTyping: () => void
  onCreateDM: (userId: string) => void
  onCreateGroup: (name: string, memberIds: string[]) => void
  onBackToList: () => void
  onNewChat: () => void
  onCloseNewChat: () => void
}

export function MessagesView({
  conversations,
  selectedConversation,
  messages,
  typingUsers,
  isUserOnline,
  isMobileView,
  showNewChat,
  loadingConversations,
  loadingMessages,
  sendingMessage,
  creatingConversation,
  isPending,
  onSelectConversation,
  onSendMessage,
  onSendFile,
  onTyping,
  onCreateDM,
  onCreateGroup,
  onBackToList,
  onNewChat,
  onCloseNewChat,
}: MessagesViewProps) {
  // Desktop: Always show both panels
  // Mobile: Show list OR chat based on selection
  const showList = !isMobileView || !selectedConversation
  const showChat = !isMobileView || selectedConversation

  return (
    <div className="h-screen flex">
      {/* Conversation List */}
      {showList && (
        <div className={`${isMobileView ? 'w-full' : 'w-80 border-r border-border'}`}>
          <ConversationList
            conversations={conversations}
            selectedId={selectedConversation?.id}
            onSelect={onSelectConversation}
            onSelectUser={onCreateDM}
            onNewChat={onNewChat}
            isLoading={loadingConversations}
            isCreatingConversation={creatingConversation}
            isPending={isPending}
          />
        </div>
      )}

      {/* Chat View */}
      {showChat && selectedConversation ? (
        <div className="flex-1">
          <ChatView
            conversation={selectedConversation}
            messages={messages}
            typingUsers={typingUsers}
            isUserOnline={isUserOnline}
            onSendMessage={onSendMessage}
            onSendFile={onSendFile}
            onBack={isMobileView ? onBackToList : undefined}
            onTyping={onTyping}
            isLoading={loadingMessages}
            isSending={sendingMessage}
          />
        </div>
      ) : (
        !isMobileView && (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            <div className="text-center">
              <MessageCircle className="h-16 w-16 mx-auto mb-4 opacity-50" />
              <p className="text-lg">Select a conversation or user to start messaging</p>
            </div>
          </div>
        )
      )}

      {/* New Chat Dialog */}
      <NewChatDialog
        open={showNewChat}
        onOpenChange={(open) => !open && onCloseNewChat()}
        onCreateDM={onCreateDM}
        onCreateGroup={onCreateGroup}
      />
    </div>
  )
}
