// Shared Chat Component Types
// These are abstracted types that work for both conversation messages and task messages

import type { UserBasic, GroupedReaction } from '@/lib/types'

/**
 * Unified chat message interface that both MessageWithSender and TaskMessageWithSender can conform to.
 * Uses a minimal interface to allow flexibility.
 */
export interface ChatMessage {
    id: string
    content: string | null
    created_at: string
    sender_id: string
    sender: UserBasic | null
    is_deleted?: boolean
    // Optional file attachment fields
    file_url?: string | null
    file_name?: string | null
    file_size?: number | null
    file_type?: string | null
    // Optional reply reference
    reply_to_id?: string | null
    // Optional reactions (may not be present for task messages)
    reactions?: Array<{
        id: string
        emoji: string
        user_id: string
        user: UserBasic | null
    }>
}

/**
 * Props for the shared ChatBubble component.
 * Features are enabled/disabled via optional callback props.
 */
export interface ChatBubbleProps {
    /** The message to display */
    message: ChatMessage
    /** All messages in the conversation (for finding reply references) */
    allMessages?: ChatMessage[]
    /** Whether this message was sent by the current user */
    isOwn: boolean
    /** Current user info (for adding reactions and identifying user) */
    currentUser?: UserBasic | null
    /** Whether this is a group chat (shows avatars/names) */
    isGroupChat?: boolean
    /** Whether to show avatar for this message */
    showAvatar?: boolean
    /** Whether to show sender name above message */
    showSenderName?: boolean

    // Feature callbacks - if undefined, feature is disabled
    /** Called when user reacts to the message (with emoji) */
    onReact?: (emoji: string) => void
    /** Called when user wants to reply to this message */
    onReply?: () => void
    /** Called when user deletes the message */
    onDelete?: () => void
    /** Called when user copies the message */
    onCopy?: () => void

    // Optional overrides
    /** Grouped reactions to display (computed from reactions array if not provided) */
    groupedReactions?: GroupedReaction[]
    /** Current user's reaction emoji on this message */
    userCurrentEmoji?: string | null

    // Styling
    className?: string
}

/**
 * Props for the shared ChatInput component.
 */
export interface ChatInputProps {
    /** Current input value */
    value: string
    /** Called when input value changes */
    onChange: (value: string) => void
    /** Called when user submits the message */
    onSend: () => void
    /** Called when typing (for typing indicators) */
    onTyping?: () => void
    /** Placeholder text */
    placeholder?: string
    /** Whether the input is disabled */
    disabled?: boolean
    /** Whether a message is currently being sent */
    isSending?: boolean

    // Feature callbacks - if undefined, feature is disabled
    /** Called when user selects a file */
    onFileSelect?: (file: File) => void
    /** Called when user sends a voice message */
    onVoiceMessage?: (audioBlob: Blob) => void
    /** Called when user selects an emoji */
    onEmojiSelect?: (emoji: string) => void

    // Reply state
    /** Message being replied to */
    replyingTo?: {
        id: string
        senderName: string
        content: string | null
        fileName?: string | null
    } | null
    /** Called when user cancels the reply */
    onCancelReply?: () => void

    // Styling
    className?: string
}

/**
 * Helper to check if a message is emoji-only (for large emoji display)
 */
export function isEmojiOnlyMessage(content: string | null): boolean {
    if (!content) return false
    const trimmed = content.trim()
    if (!trimmed) return false

    // Remove all emoji characters and check if anything remains
    const withoutEmojis = trimmed
        .replace(/\p{Extended_Pictographic}/gu, '')
        .replace(/[\u{1F3FB}-\u{1F3FF}]/gu, '') // Skin tone modifiers
        .replace(/\u{FE0F}/gu, '') // Variation selector
        .replace(/\u{200D}/gu, '') // ZWJ
        .trim()

    // If there's any text left after removing emojis, it's not emoji-only
    if (withoutEmojis.length > 0) return false

    // Count grapheme clusters (each emoji, even compound ones, count as 1)
    const segments = [...new Intl.Segmenter('en', { granularity: 'grapheme' }).segment(trimmed)]
    return segments.length <= 3
}
