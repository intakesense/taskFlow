// Database Types for Task Management App
// Types are now generated from Supabase schema
import { Database } from './database.types';

// Re-export core database types from generated schema
export type User = Database['public']['Tables']['users']['Row'];
export type Task = Database['public']['Tables']['tasks']['Row'];
export type TaskMessage = Database['public']['Tables']['task_messages']['Row'];
export type TaskNote = Database['public']['Tables']['task_notes']['Row'];
export type Conversation = Database['public']['Tables']['conversations']['Row'];
export type ConversationMember = Database['public']['Tables']['conversation_members']['Row'];
export type Message = Database['public']['Tables']['messages']['Row'];
export type MessageRead = Database['public']['Tables']['message_reads']['Row'];
export type MessageReaction = Database['public']['Tables']['message_reactions']['Row'];
export type TaskMessageReaction = Database['public']['Tables']['task_message_reactions']['Row'];
export type TypingStatus = Database['public']['Tables']['typing_status']['Row'];
export type AppSettings = Database['public']['Tables']['app_settings']['Row'];

// Type aliases for convenience
export type UserLevel = number; // 1 = highest authority (L1, L2, L3...)
export type TaskStatus = 'pending' | 'in_progress' | 'on_hold' | 'archived';
export type TaskPriority = 'low' | 'medium' | 'high';
export type Visibility = 'private' | 'supervisor' | 'hierarchy_same' | 'hierarchy_above' | 'all';
export type TaskMessageType = 'message' | 'progress';

// Extended types with relations
// Basic user info from joined queries (partial User)
export interface UserBasic {
    id: string;
    name: string;
    email: string;
    level: UserLevel;
    avatar_url?: string | null;
}

// Assignee with assignment timestamp (for multi-assignee support)
export interface AssigneeWithDetails extends UserBasic {
    assigned_at: string;
}

// Conversation member with read status
export interface ConversationMemberWithUser {
    user: UserBasic;
    last_read_at: string;
    joined_at: string;
}

export interface TaskWithUsers extends Task {
    assigner: UserBasic | null;
    assignee: UserBasic | null; // DEPRECATED: Use assignees array instead. Kept for backward compatibility.
    assignees: AssigneeWithDetails[]; // Array of assignees for multi-assignee support
}

// Reaction with user info for task messages
export interface TaskReactionWithUser extends TaskMessageReaction {
    user: UserBasic | null;
}

export interface TaskMessageWithSender extends TaskMessage {
    sender: UserBasic | null;
    replyTo?: TaskMessageWithSender | null;
    reactions?: TaskReactionWithUser[];
}

export interface TaskNoteWithAuthor extends TaskNote {
    author: UserBasic | null;
}

// Progress update with nested comments
export interface ProgressUpdateWithComments extends TaskMessageWithSender {
    comments: TaskMessageWithSender[];
    commentCount: number;
}

// Grouped progress updates by date for timeline display
export interface ProgressUpdatesByDate {
    date: string; // ISO date string (e.g., "2026-03-05")
    dateLabel: string; // Formatted label (e.g., "MON 5 MAR")
    updates: ProgressUpdateWithComments[];
}

// Progress update with task info for all-tasks feed
export interface ProgressUpdateWithTask extends TaskMessageWithSender {
    task: {
        id: string;
        title: string;
        status: string;
    };
}

// Extended types with relations (not in database, computed from joins)
export interface ConversationWithMembers extends Conversation {
    members: UserBasic[]; // For backward compatibility
    membersWithStatus?: ConversationMemberWithUser[]; // Includes last_read_at
    lastMessage?: MessageWithSender | null;
    unreadCount?: number;
}

// Reaction with user info for display
export interface ReactionWithUser extends MessageReaction {
    user: UserBasic | null;
}

// Grouped reactions for display (e.g., "👍 3")
export interface GroupedReaction {
    emoji: string;
    count: number;
    users: UserBasic[];
    hasReacted: boolean; // Whether current user has reacted with this emoji
}

export interface MessageWithSender extends Message {
    sender: UserBasic | null;
    replyTo?: MessageWithSender | null;
    readBy?: UserBasic[];
    reactions?: ReactionWithUser[];
}

// Voice Channel Types
export type VoiceChannel = Database['public']['Tables']['voice_channels']['Row'];
export type VoiceChannelParticipant = Database['public']['Tables']['voice_channel_participants']['Row'];
export type VoiceChannelSession = Database['public']['Tables']['voice_channel_sessions']['Row'];

export interface VoiceParticipantWithUser extends VoiceChannelParticipant {
    user: UserBasic;
}

export interface VoiceChannelWithParticipants extends VoiceChannel {
    participants: VoiceParticipantWithUser[];
    participantCount: number;
}

// Daily.co specific types
export interface DailyRoomInfo {
    url: string;
    token: string;
    roomName: string;
}
