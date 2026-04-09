'use client';

import {
  useState,
  useEffect,
  useCallback,
  useRef,
  useTransition,
  type ReactNode,
} from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useAuth } from '../../providers/auth-context';
import { useServices } from '../../providers/services-context';
import {
  useConversations,
  useCreateDM,
  useCreateGroup,
  useMarkAsRead,
} from '../../hooks/use-conversations';
import {
  useChatMessages,
  useConversationRealtime,
  useSendChatMessage,
  useSetTyping,
  chatMessageKeys,
  createFetchMessages,
} from '../../hooks/use-chat-messages';
import { useMobile, useBackNavigation } from '../../hooks';
import { MessagesView } from './messages-view';
import type { ConversationWithMembers } from '@taskflow/core';

interface MessagesContainerProps {
  initialConversations?: ConversationWithMembers[];
  /** Optional chat pattern for background styling */
  chatPattern?: string;
  /** Render prop for file preview before sending (platform-specific) */
  renderFilePreview?: (props: { file: File; onRemove: () => void }) => ReactNode;
  /** Optional header actions for conversation list (e.g., AI voice chat button) */
  renderConversationListHeaderActions?: () => ReactNode;
}

export function MessagesContainer({
  initialConversations,
  chatPattern,
  renderFilePreview,
  renderConversationListHeaderActions,
}: MessagesContainerProps) {
  const { user, profile, effectiveUser } = useAuth();
  const { fileUpload, supabase } = useServices();
  const [selectedConversation, setSelectedConversation] =
    useState<ConversationWithMembers | null>(null);
  const [showNewChat, setShowNewChat] = useState(false);
  const isMobileView = useMobile();

  // useTransition for non-blocking conversation switching
  const [isPending, startTransition] = useTransition();

  // Handle browser back button - returns to conversation list instead of leaving app
  const handleBackToList = useCallback(() => {
    setSelectedConversation(null);
  }, []);

  useBackNavigation(
    !!selectedConversation && isMobileView,
    handleBackToList,
    isMobileView
  );

  // Close chat on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && selectedConversation) handleBackToList();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedConversation, handleBackToList]);

  // NOTE: Server handles auth redirect in page.tsx, no need for client-side check

  // Hooks - pass initialData from server for instant first paint
  const queryClient = useQueryClient();
  const { data: conversations = [], isLoading: loadingConversations } =
    useConversations(effectiveUser?.id, { initialData: initialConversations });

  // AGGRESSIVE PREFETCHING: Preload ALL conversation messages on mount
  // Since we only have ~20 employees, this is fast and makes switching instant
  useEffect(() => {
    if (conversations.length === 0) return;

    const fetchMessages = createFetchMessages(supabase);
    conversations.forEach((conv) => {
      queryClient.prefetchQuery({
        queryKey: chatMessageKeys.conversation(conv.id),
        queryFn: () => fetchMessages(conv.id),
        staleTime: 60_000, // Consider fresh for 1 minute
      });
    });
  }, [conversations, queryClient, supabase]);

  const { data: messages = [], isLoading: loadingMessages } = useChatMessages(
    selectedConversation?.id
  );

  const sendMessage = useSendChatMessage();
  const createDM = useCreateDM();
  const createGroup = useCreateGroup();
  const markAsRead = useMarkAsRead();
  const { setTyping, clearTyping } = useSetTyping();

  // Debounced mark as read - prevents rapid-fire DB writes when multiple messages arrive
  const markAsReadTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastMarkedConversationRef = useRef<string | null>(null);

  const debouncedMarkAsRead = useCallback(
    (conversationId: string, userId: string) => {
      // Clear any pending timeout
      if (markAsReadTimeoutRef.current) {
        clearTimeout(markAsReadTimeoutRef.current);
      }

      // Debounce: wait 300ms before actually marking as read
      // This batches multiple rapid messages into a single DB write
      markAsReadTimeoutRef.current = setTimeout(() => {
        markAsRead.mutate({ conversationId, userId });
        lastMarkedConversationRef.current = conversationId;
        markAsReadTimeoutRef.current = null;
      }, 300);
    },
    [markAsRead]
  );

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (markAsReadTimeoutRef.current) {
        clearTimeout(markAsReadTimeoutRef.current);
      }
    };
  }, []);

  // Callback when new messages arrive while chat is open
  const handleNewMessageArrived = useCallback(
    (message: { sender_id: string }) => {
      // Only mark as read if message is from someone else
      if (
        selectedConversation?.id &&
        effectiveUser?.id &&
        message.sender_id !== effectiveUser.id
      ) {
        debouncedMarkAsRead(selectedConversation.id, effectiveUser.id);
      }
    },
    [selectedConversation?.id, effectiveUser?.id, debouncedMarkAsRead]
  );

  // CONSOLIDATED: Single hook for messages + typing + online status
  const { typingUsers, isUserOnline } = useConversationRealtime(
    selectedConversation?.id,
    effectiveUser?.id,
    handleNewMessageArrived
  );

  // Mark as read when opening a conversation (immediate, not debounced)
  useEffect(() => {
    if (selectedConversation?.id && effectiveUser?.id) {
      // Skip if we just marked this conversation as read via the debounced handler
      if (lastMarkedConversationRef.current === selectedConversation.id) {
        lastMarkedConversationRef.current = null;
        return;
      }
      markAsRead.mutate({
        conversationId: selectedConversation.id,
        userId: effectiveUser.id,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedConversation?.id, effectiveUser?.id]);

  // Sync selectedConversation with updated data from conversations query
  // This ensures the UI updates when members are added/removed, name changes, etc.
  useEffect(() => {
    if (!selectedConversation?.id) return;
    const updated = conversations.find((c) => c.id === selectedConversation.id);
    if (updated && updated !== selectedConversation) {
      // Only update if the data actually changed (compare by reference since React Query returns new objects)
      const membersChanged =
        updated.members.length !== selectedConversation.members.length ||
        updated.members.some(
          (m, i) => m.id !== selectedConversation.members[i]?.id
        );
      const nameChanged = updated.name !== selectedConversation.name;
      const avatarChanged = updated.avatar_url !== selectedConversation.avatar_url;

      if (membersChanged || nameChanged || avatarChanged) {
        setSelectedConversation(updated);
      }
    }
  }, [conversations, selectedConversation]);

  // Handlers - use startTransition for non-blocking conversation switching
  const handleSelectConversation = (conv: ConversationWithMembers) => {
    startTransition(() => {
      setSelectedConversation(conv);
    });
  };

  const handleSendMessage = (content: string, replyToId?: string) => {
    if (!selectedConversation || !effectiveUser?.id) return;

    sendMessage.mutate(
      {
        conversationId: selectedConversation.id,
        senderId: effectiveUser.id,
        content,
        replyToId,
      },
      {
        onError: (error) => {
          console.error('Failed to send message:', error);
          const message =
            error instanceof Error ? error.message : 'Failed to send message';
          toast.error(message);
        },
      }
    );

    // Clear typing indicator (preserves online status)
    clearTyping(selectedConversation.id, effectiveUser.id);
  };

  const handleTyping = () => {
    if (!selectedConversation || !effectiveUser?.id) return;
    // Pass full user object for Presence
    setTyping(selectedConversation.id, effectiveUser.id, {
      id: effectiveUser.id,
      name: effectiveUser.name,
      email: effectiveUser.email,
      level: effectiveUser.level,
    });
  };

  const handleSendFile = async (file: File, replyToId?: string) => {
    if (!selectedConversation || !effectiveUser?.id) return;

    try {
      toast.loading('Uploading file...', { id: 'file-upload' });

      // Upload file to storage
      const uploadedFile = await fileUpload.uploadFile(file, effectiveUser.id);

      // Send message with file attachment
      await sendMessage.mutateAsync({
        conversationId: selectedConversation.id,
        senderId: effectiveUser.id,
        fileUrl: uploadedFile.url,
        fileName: file.name,
        fileSize: uploadedFile.size,
        fileType: uploadedFile.type,
        replyToId,
      });

      toast.success('File uploaded successfully', { id: 'file-upload' });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to upload file';
      toast.error(message, { id: 'file-upload' });
    }
  };

  const handleCreateDM = async (userId: string) => {
    if (!effectiveUser?.id) return;
    try {
      const conv = await createDM.mutateAsync({
        userId: effectiveUser.id,
        otherUserId: userId,
      });
      setShowNewChat(false);
      // Note: toast is shown by useCreateDM hook

      // Wait a moment for the query to refetch, then select the conversation
      setTimeout(() => {
        const enriched = conversations.find((c) => c.id === conv.id);
        if (enriched) {
          setSelectedConversation(enriched);
        }
      }, 100);
    } catch (error) {
      console.error('DM creation error:', error);
      // Note: error toast is shown by useCreateDM hook
    }
  };

  const handleCreateGroup = async (name: string, memberIds: string[]) => {
    if (!effectiveUser?.id) return;
    try {
      const conv = await createGroup.mutateAsync({
        userId: effectiveUser.id,
        input: { name, memberIds },
      });
      setShowNewChat(false);
      // Note: toast is shown by useCreateGroup hook

      // Wait a moment for the query to refetch, then select the conversation
      setTimeout(() => {
        const enriched = conversations.find((c) => c.id === conv.id);
        if (enriched) {
          setSelectedConversation(enriched);
        }
      }, 100);
    } catch (error) {
      console.error('Group creation error:', error);
      // Note: error toast is shown by useCreateGroup hook
    }
  };

  // Show skeleton while auth is initializing - prevents white flash
  // Pass loadingConversations=true when auth is still loading to show skeleton
  const isAuthLoading = !user || !profile;

  return (
    <MessagesView
      conversations={conversations}
      selectedConversation={selectedConversation}
      messages={messages}
      typingUsers={typingUsers}
      isUserOnline={isUserOnline}
      isMobileView={isMobileView}
      showNewChat={showNewChat}
      loadingConversations={isAuthLoading || loadingConversations}
      loadingMessages={loadingMessages}
      sendingMessage={sendMessage.isPending}
      creatingConversation={createDM.isPending || createGroup.isPending}
      isPending={isPending}
      currentUserId={effectiveUser?.id}
      onSelectConversation={handleSelectConversation}
      onSendMessage={handleSendMessage}
      onSendFile={handleSendFile}
      onTyping={handleTyping}
      onCreateDM={handleCreateDM}
      onCreateGroup={handleCreateGroup}
      onBackToList={handleBackToList}
      onNewChat={() => setShowNewChat(true)}
      onCloseNewChat={() => setShowNewChat(false)}
      chatPattern={chatPattern}
      renderFilePreview={renderFilePreview}
      renderConversationListHeaderActions={renderConversationListHeaderActions}
    />
  );
}
