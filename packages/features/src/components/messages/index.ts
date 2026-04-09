// Messages components - Session 4-5 (primitives)
export { OnlineStatusBadge, OnlineStatusDot } from './online-status-badge';
export { TypingBubble } from './typing-bubble';
export { MessageStatus } from './message-status';
export { ProfilePictureDialog } from './profile-picture-dialog';
export {
  ReactionBadges,
  QuickReactionsBar,
  MessageActions,
  MobileMessageActions,
} from './message-reactions';
export { FileAttachment, formatFileSize } from './file-attachment';
export { FilePreviewModal } from './file-preview-modal';
export { VoiceRecorder, AudioMessagePlayer } from './voice-recorder';

// Session 6 - Conversation system components
export {
  ConversationList,
  getConversationName,
  getConversationAvatar,
} from './conversation-list';
export { MessagesView } from './messages-view';
export { MessagesContainer } from './messages-container';
export { NewChatDialog } from './new-chat-dialog';

// Session 7 - Chat system components
export { ChatView } from './chat-view';
export { GroupSettingsDialog } from './group-settings-dialog';

// Re-export chat message hooks from hooks directory
export {
  useChatMessages,
  useSendChatMessage,
  useConversationRealtime,
  useSetTyping,
  useMarkChatAsRead,
  chatMessageKeys,
  createFetchMessages,
} from '../../hooks/use-chat-messages';

// Re-export audio recorder hook
export { useAudioRecorder, formatRecordingTime } from '../../hooks/use-audio-recorder';

// Note: Reaction hooks (useSetReaction, groupReactions, getUserReaction, QUICK_REACTIONS)
// are exported from ../../hooks/use-reactions via the main hooks export
