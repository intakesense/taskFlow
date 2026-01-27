// Hooks barrel export

// Theme
export { useTheme } from './use-theme';

// Tasks
export { useTasks, useTask, useCreateTask, useUpdateTask, useDeleteTask, taskKeys } from './use-tasks';
export { useTaskMessages, useSendTaskMessage, useTaskMessagesRealtime, taskMessageKeys } from './use-task-messages';
export { useTaskNotes, useAddTaskNote, useDeleteTaskNote, taskNoteKeys } from './use-task-notes';

// Users
export { useUsers, useUser, useAssignableUsers, useUpdateUser, useDeleteUser, getLevelLabel, getLevelColor, userKeys } from './use-users';

// Legacy (keeping for backwards compatibility)
export { useMessages, useSendMessage, useRealtimeMessages, messageKeys } from './use-messages';
export { useNotes, useCreateNote, useUpdateNote, useDeleteNote, getVisibilityLabel, noteKeys } from './use-notes';

// Messaging
export { useConversations, useCreateDM, useCreateGroup, useConversationsRealtime, conversationKeys } from './use-conversations';
export { useChatMessages, useSendMessage as useSendChatMessage, useSearchMessages, useMarkAsRead, useDeleteMessage, useConversationRealtime, useSetTyping, messageKeys as chatMessageKeys, fetchMessages } from './use-chat-messages';
export { useSetReaction, groupReactions, getUserReaction, QUICK_REACTIONS } from './use-reactions';

// Common utilities
export { useDialog, useDialogs } from './use-dialog';
export { useAsync } from './use-async';
export { useMobile, useBreakpoints } from './use-mobile';
export { useUpdatingTimestamp, useUpdatingRelativeTime } from './use-updating-timestamp';
export { useFormattedTimestamp, useFormattedRelativeTime, useGlobalTime } from '@/lib/global-clock';
export { useAudioRecorder, formatRecordingTime } from './use-audio-recorder';
export { useBackNavigation } from './use-back-navigation';
export { useSwipeGesture } from './use-swipe-gesture';
