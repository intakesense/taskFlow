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
export type TypingStatus = Database['public']['Tables']['typing_status']['Row'];
export type AppSettings = Database['public']['Tables']['app_settings']['Row'];

// Type aliases for convenience
export type UserLevel = number; // 1 = highest authority (L1, L2, L3...)
export type TaskStatus = 'pending' | 'in_progress' | 'on_hold' | 'archived';
export type TaskPriority = 'low' | 'medium' | 'high';
export type Visibility = 'private' | 'supervisor' | 'hierarchy_same' | 'hierarchy_above' | 'all';

// Extended types with relations
// Basic user info from joined queries (partial User)
export interface UserBasic {
    id: string;
    name: string;
    email: string;
    level: UserLevel;
}

// Conversation member with read status
export interface ConversationMemberWithUser {
    user: UserBasic;
    last_read_at: string;
    joined_at: string;
}

export interface TaskWithUsers extends Task {
    assigner: UserBasic | null;
    assignee: UserBasic | null;
}

export interface TaskMessageWithSender extends TaskMessage {
    sender: UserBasic | null;
}

export interface TaskNoteWithAuthor extends TaskNote {
    author: UserBasic | null;
}

// Extended types with relations (not in database, computed from joins)
export interface ConversationWithMembers extends Conversation {
    members: UserBasic[]; // For backward compatibility
    membersWithStatus?: ConversationMemberWithUser[]; // Includes last_read_at
    lastMessage?: MessageWithSender | null;
    unreadCount?: number;
}

export interface MessageWithSender extends Message {
    sender: UserBasic | null;
    replyTo?: MessageWithSender | null;
    readBy?: UserBasic[];
}
