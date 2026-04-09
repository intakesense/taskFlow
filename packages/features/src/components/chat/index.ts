// Shared Chat Components
// These components work for both conversation messages and task messages

export { ChatBubble } from './chat-bubble';
export { ChatInput } from './chat-input';
export { MentionPopup } from './mention-popup';
export type { ChatMessage, ChatBubbleProps, ChatInputProps } from './types';
export { isEmojiOnlyMessage } from './types';
export {
  PATTERN_LABELS,
  PATTERN_DESCRIPTIONS,
  type ChatPatternType,
} from './chat-patterns';
