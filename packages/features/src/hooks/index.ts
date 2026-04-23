'use client';

export {
  useTasks,
  useTasksInfinite,
  useTask,
  useCreateTask,
  useUpdateTask,
  useDeleteTask,
  useArchiveTask,
  useChangeTaskStatus,
  useUpdateTaskAssignees,
  useTaskAuditLog,
  taskKeys,
} from './use-tasks';

export {
  useUsers,
  useAssignableUsers,
  useUser,
  userKeys,
} from './use-users';

export {
  useConversations,
  useMessages,
  useSendMessage,
  useCreateDM,
  useCreateGroup,
  useMarkAsRead,
  // Group management hooks
  useUpdateGroupName,
  useAddGroupMembers,
  useRemoveGroupMember,
  useLeaveGroup,
  useUpdateGroupAvatar,
  useUploadGroupAvatar,
  conversationKeys,
} from './use-conversations';

export { useMediaQuery } from './use-media-query';

export {
  useAllProgressFeed,
  useTaskProgress,
  useTaskProgressByDate,
  useCreateProgressUpdate,
  useAddProgressComment,
  useTaskProgressRealtime,
  taskProgressKeys,
} from './use-task-progress';

export {
  useTaskMessages,
  useSendTaskMessage,
  useDeleteTaskMessage,
  useSetTaskReaction,
  useTaskMessagesRealtime,
  taskMessageKeys,
  QUICK_REACTIONS as TASK_QUICK_REACTIONS,
  groupTaskReactions,
  getUserTaskReaction,
} from './use-task-messages';

export {
  useTaskNotes,
  useAddTaskNote,
  useDeleteTaskNote,
  taskNoteKeys,
} from './use-task-notes';

export { useDialog, useDialogs, type UseDialogReturn } from './use-dialog';

export { useMentions } from './use-mentions';

export { useSwipeGesture } from './use-swipe-gesture';

export { useMobile, useBreakpoints } from './use-mobile';

export { useBackNavigation } from './use-back-navigation';

export {
  useSetReaction,
  groupReactions,
  getUserReaction,
  QUICK_REACTIONS,
  type SetReactionInput,
} from './use-reactions';

export {
  useChatMessages,
  useSendChatMessage,
  useConversationRealtime,
  useSetTyping,
  useMarkChatAsRead,
  chatMessageKeys,
  createFetchMessages,
} from './use-chat-messages';

export {
  useAudioRecorder,
  formatRecordingTime,
  type RecordingState,
} from './use-audio-recorder';

export {
  useVoiceChannels,
  useVoiceChannelsRealtime,
  useDefaultVoiceChannel,
  useCreateVoiceChannel,
  useDeleteVoiceChannel,
  voiceChannelKeys,
} from './use-voice-channels';

export {
  useDriveAttachments,
  useInvalidateDriveAttachments,
  driveAttachmentKeys,
} from './use-drive-attachments';
