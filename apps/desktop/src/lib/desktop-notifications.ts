/**
 * Desktop Notifications Service
 *
 * WhatsApp-style native notifications for the TaskFlow desktop app.
 * Listens to Supabase realtime events and triggers native OS notifications.
 */

import type { SupabaseClient, RealtimeChannel } from '@supabase/supabase-js';
import type { Database } from '@taskflow/core/types/database';

// Navigation callback for notification clicks
let navigationCallback: ((path: string) => void) | null = null;

/**
 * Set the navigation callback for handling notification clicks
 */
export function setNotificationNavigationCallback(callback: (path: string) => void): void {
  navigationCallback = callback;
}

/**
 * Initialize notification click handler
 */
export async function initializeNotificationClickHandler(): Promise<void> {
  try {
    const { onAction } = await import('@tauri-apps/plugin-notification');
    await onAction((notification) => {
      console.log('[DesktopNotifications] Notification clicked:', notification);

      // Parse the action type ID which contains "type:id"
      const actionId = notification.actionTypeId;
      if (!actionId || !navigationCallback) return;

      const [type, targetId] = actionId.split(':');
      if (!type || !targetId) return;

      // Navigate based on notification type
      let path: string;
      switch (type) {
        case 'message':
        case 'mention':
          path = `/chat/${targetId}`;
          break;
        case 'task':
        case 'assignment':
        case 'progress':
          path = `/tasks/${targetId}`;
          break;
        default:
          console.warn('[DesktopNotifications] Unknown notification type:', type);
          return;
      }

      // Focus the window and navigate
      focusWindow().then(() => {
        navigationCallback?.(path);
      });
    });
    console.log('[DesktopNotifications] Click handler initialized');
  } catch (error) {
    console.error('[DesktopNotifications] Failed to initialize click handler:', error);
  }
}

/**
 * Focus the main window
 */
async function focusWindow(): Promise<void> {
  try {
    const { getCurrentWindow } = await import('@tauri-apps/api/window');
    const window = getCurrentWindow();
    await window.show();
    await window.unminimize();
    await window.setFocus();
  } catch (error) {
    console.error('[DesktopNotifications] Failed to focus window:', error);
  }
}

// Notification preference keys (must match desktop-notifications.tsx)
const STORAGE_KEYS = {
  notifications: 'taskflow-notifications-enabled',
  sound: 'taskflow-sound-enabled',
  messageNotifications: 'taskflow-message-notifications',
  taskNotifications: 'taskflow-task-notifications',
  progressNotifications: 'taskflow-progress-notifications',
  mentionNotifications: 'taskflow-mention-notifications',
} as const;

// Notification types
export type NotificationType = 'message' | 'task' | 'progress' | 'mention' | 'assignment';

export interface NotificationPayload {
  title: string;
  body: string;
  notificationType?: NotificationType;
  targetId?: string;
  senderName?: string;
  contextName?: string;
  /** Avatar URL for profile picture (circular like WhatsApp) */
  avatarUrl?: string;
  /** Image URL for photo attachments (hero image preview) */
  imageUrl?: string;
}

// Message payload from realtime
interface MessagePayload {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string | null;
  file_url: string | null;
  created_at: string;
}

// Task message payload
interface TaskMessagePayload {
  id: string;
  task_id: string;
  user_id: string;
  content: string | null;
  message_type: 'message' | 'progress';
  progress_percentage: number | null;
  created_at: string;
}

// Task assignment payload
interface TaskAssignmentPayload {
  task_id: string;
  user_id: string;
}

// Task status change payload
interface TaskPayload {
  id: string;
  title: string;
  status: string;
  assigned_by: string;
}

/**
 * Check if notifications are enabled in settings
 */
function isNotificationsEnabled(): boolean {
  try {
    const value = localStorage.getItem(STORAGE_KEYS.notifications);
    return value !== 'false'; // Default to enabled
  } catch {
    return true;
  }
}

/**
 * Check if a specific notification type is enabled
 */
function isNotificationTypeEnabled(type: NotificationType): boolean {
  if (!isNotificationsEnabled()) return false;

  try {
    switch (type) {
      case 'message':
        return localStorage.getItem(STORAGE_KEYS.messageNotifications) !== 'false';
      case 'task':
      case 'assignment':
        return localStorage.getItem(STORAGE_KEYS.taskNotifications) !== 'false';
      case 'progress':
        return localStorage.getItem(STORAGE_KEYS.progressNotifications) !== 'false';
      case 'mention':
        return localStorage.getItem(STORAGE_KEYS.mentionNotifications) !== 'false';
      default:
        return true;
    }
  } catch {
    return true;
  }
}

/**
 * Check if sound is enabled in settings
 */
function isSoundEnabled(): boolean {
  try {
    const value = localStorage.getItem(STORAGE_KEYS.sound);
    return value !== 'false'; // Default to enabled
  } catch {
    return true;
  }
}

/**
 * Check if the app window is currently focused
 */
function isWindowFocused(): boolean {
  return document.hasFocus();
}

/**
 * Play notification sound
 */
async function playNotificationSound(): Promise<void> {
  if (!isSoundEnabled()) return;

  try {
    // Use Web Audio API for notification sound
    const audioContext = new AudioContext();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    // WhatsApp-style notification sound (two quick beeps)
    oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
    oscillator.type = 'sine';

    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);

    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.1);

    // Second beep
    setTimeout(() => {
      const osc2 = audioContext.createOscillator();
      const gain2 = audioContext.createGain();
      osc2.connect(gain2);
      gain2.connect(audioContext.destination);
      osc2.frequency.setValueAtTime(1000, audioContext.currentTime);
      osc2.type = 'sine';
      gain2.gain.setValueAtTime(0.3, audioContext.currentTime);
      gain2.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);
      osc2.start(audioContext.currentTime);
      osc2.stop(audioContext.currentTime + 0.1);
    }, 100);
  } catch (error) {
    console.error('Failed to play notification sound:', error);
  }
}

/**
 * Show a native desktop notification via Tauri
 * WhatsApp-style: circular avatar, image preview, quick reply
 */
export async function showNotification(payload: NotificationPayload): Promise<void> {
  // Check master toggle
  if (!isNotificationsEnabled()) return;

  // Check notification type-specific toggle
  if (payload.notificationType && !isNotificationTypeEnabled(payload.notificationType)) {
    return;
  }

  // Don't show notifications if window is focused (user is looking at the app)
  if (isWindowFocused()) return;

  try {
    const { invoke } = await import('@tauri-apps/api/core');

    await invoke('show_notification', { payload });
    await playNotificationSound();
  } catch (error) {
    console.error('Failed to show notification:', error);
  }
}

/**
 * Truncate message content for notification body
 */
function truncateContent(content: string | null, maxLength = 100): string {
  if (!content) return 'Sent an attachment';
  if (content.length <= maxLength) return content;
  return content.slice(0, maxLength - 3) + '...';
}

/**
 * Desktop Notification Manager
 *
 * Manages Supabase realtime subscriptions for notifications.
 * Should be initialized once when the user logs in.
 */
export class DesktopNotificationManager {
  private supabase: SupabaseClient<Database>;
  private userId: string;
  private channels: RealtimeChannel[] = [];
  private userCache: Map<string, { name: string; avatar_url?: string | null }> = new Map();
  private conversationCache: Map<string, { name?: string | null; is_group: boolean }> = new Map();
  private taskCache: Map<string, { title: string }> = new Map();

  constructor(supabase: SupabaseClient<Database>, userId: string) {
    this.supabase = supabase;
    this.userId = userId;
  }

  /**
   * Fetch user info for notification display
   */
  private async getUserInfo(userId: string): Promise<{ name: string; avatar_url?: string | null }> {
    if (this.userCache.has(userId)) {
      return this.userCache.get(userId)!;
    }

    const { data } = await this.supabase
      .from('users')
      .select('name, avatar_url')
      .eq('id', userId)
      .single();

    const info = { name: data?.name || 'Unknown', avatar_url: data?.avatar_url };
    this.userCache.set(userId, info);
    return info;
  }

  /**
   * Fetch conversation info for notification display
   */
  private async getConversationInfo(
    conversationId: string,
    senderId: string
  ): Promise<{ name: string; isGroup: boolean }> {
    if (this.conversationCache.has(conversationId)) {
      const cached = this.conversationCache.get(conversationId)!;
      if (cached.is_group && cached.name) {
        return { name: cached.name, isGroup: true };
      }
    }

    const { data: conv } = await this.supabase
      .from('conversations')
      .select('name, is_group')
      .eq('id', conversationId)
      .single();

    if (conv) {
      this.conversationCache.set(conversationId, { name: conv.name, is_group: conv.is_group });
      if (conv.is_group && conv.name) {
        return { name: conv.name, isGroup: true };
      }
    }

    // For DMs, use the sender's name
    const sender = await this.getUserInfo(senderId);
    return { name: sender.name, isGroup: false };
  }

  /**
   * Fetch task info for notification display
   */
  private async getTaskInfo(taskId: string): Promise<{ title: string }> {
    if (this.taskCache.has(taskId)) {
      return this.taskCache.get(taskId)!;
    }

    const { data } = await this.supabase
      .from('tasks')
      .select('title')
      .eq('id', taskId)
      .single();

    const info = { title: data?.title || 'Unknown Task' };
    this.taskCache.set(taskId, info);
    return info;
  }

  /**
   * Handle new chat message
   */
  private async handleNewMessage(payload: MessagePayload): Promise<void> {
    // Don't notify for own messages
    if (payload.sender_id === this.userId) return;

    const sender = await this.getUserInfo(payload.sender_id);
    const conversation = await this.getConversationInfo(payload.conversation_id, payload.sender_id);

    const title = conversation.isGroup
      ? `${sender.name} in ${conversation.name}`
      : sender.name;

    // Check if message has an image attachment
    const hasImage = payload.file_url && this.isImageUrl(payload.file_url);
    const body = hasImage && !payload.content
      ? 'Sent a photo'
      : truncateContent(payload.content);

    // Check for mentions
    const hasMention = payload.content?.includes(`@${this.userId}`) || false;

    await showNotification({
      title,
      body,
      notificationType: hasMention ? 'mention' : 'message',
      targetId: payload.conversation_id,
      senderName: sender.name,
      contextName: conversation.name,
      avatarUrl: sender.avatar_url || undefined,
      imageUrl: hasImage ? payload.file_url! : undefined,
    });
  }

  /**
   * Check if URL points to an image file
   */
  private isImageUrl(url: string): boolean {
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'];
    const lowerUrl = url.toLowerCase();
    return imageExtensions.some(ext => lowerUrl.includes(ext));
  }

  /**
   * Handle new task message or progress update
   */
  private async handleNewTaskMessage(payload: TaskMessagePayload): Promise<void> {
    // Don't notify for own messages
    if (payload.user_id === this.userId) return;

    const sender = await this.getUserInfo(payload.user_id);
    const task = await this.getTaskInfo(payload.task_id);

    const isProgress = payload.message_type === 'progress';
    const title = isProgress
      ? `${sender.name} updated progress on "${task.title}"`
      : `${sender.name} commented on "${task.title}"`;

    const body = isProgress && payload.progress_percentage !== null
      ? `Progress: ${payload.progress_percentage}%${payload.content ? ` - ${truncateContent(payload.content, 60)}` : ''}`
      : truncateContent(payload.content);

    await showNotification({
      title,
      body,
      notificationType: isProgress ? 'progress' : 'task',
      targetId: payload.task_id,
      senderName: sender.name,
      contextName: task.title,
      avatarUrl: sender.avatar_url || undefined,
    });
  }

  /**
   * Handle task assignment
   */
  private async handleTaskAssignment(payload: TaskAssignmentPayload): Promise<void> {
    // Only notify if assigned to current user
    if (payload.user_id !== this.userId) return;

    const task = await this.getTaskInfo(payload.task_id);

    await showNotification({
      title: 'New Task Assigned',
      body: `You have been assigned to "${task.title}"`,
      notificationType: 'assignment',
      targetId: payload.task_id,
      contextName: task.title,
    });
  }

  /**
   * Handle task status change
   */
  private async handleTaskStatusChange(
    newPayload: TaskPayload,
    oldPayload: TaskPayload
  ): Promise<void> {
    // Don't notify if user made the change (task creator)
    if (newPayload.assigned_by === this.userId) return;

    // Only notify on status changes
    if (newPayload.status === oldPayload.status) return;

    const statusLabels: Record<string, string> = {
      pending: 'Pending',
      in_progress: 'In Progress',
      review: 'In Review',
      completed: 'Completed',
      cancelled: 'Cancelled',
    };

    await showNotification({
      title: `Task Status Changed`,
      body: `"${newPayload.title}" is now ${statusLabels[newPayload.status] || newPayload.status}`,
      notificationType: 'task',
      targetId: newPayload.id,
      contextName: newPayload.title,
    });
  }

  /**
   * Subscribe to all notification channels
   */
  async subscribe(): Promise<void> {
    // Channel 1: New messages in conversations the user is part of
    const messagesChannel = this.supabase
      .channel('desktop-notifications-messages')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
        },
        async (payload) => {
          try {
            // Check if user is a member of this conversation
            const { data: membership } = await this.supabase
              .from('conversation_members')
              .select('user_id')
              .eq('conversation_id', payload.new.conversation_id)
              .eq('user_id', this.userId)
              .single();

            if (membership) {
              await this.handleNewMessage(payload.new as MessagePayload);
            }
          } catch (error) {
            console.error('Error handling message notification:', error);
          }
        }
      )
      .subscribe();

    this.channels.push(messagesChannel);

    // Channel 2: Task messages for tasks the user is assigned to or created
    const taskMessagesChannel = this.supabase
      .channel('desktop-notifications-task-messages')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'task_messages',
        },
        async (payload) => {
          try {
            // Check if user is involved with this task
            const { data: assignment } = await this.supabase
              .from('task_assignees')
              .select('user_id')
              .eq('task_id', payload.new.task_id)
              .eq('user_id', this.userId)
              .single();

            if (assignment) {
              await this.handleNewTaskMessage(payload.new as TaskMessagePayload);
              return;
            }

            // Also check if user created the task
            const { data: task } = await this.supabase
              .from('tasks')
              .select('assigned_by')
              .eq('id', payload.new.task_id)
              .single();

            if (task?.assigned_by === this.userId) {
              await this.handleNewTaskMessage(payload.new as TaskMessagePayload);
            }
          } catch (error) {
            console.error('Error handling task message notification:', error);
          }
        }
      )
      .subscribe();

    this.channels.push(taskMessagesChannel);

    // Channel 3: Task assignments
    const assignmentsChannel = this.supabase
      .channel('desktop-notifications-assignments')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'task_assignees',
          filter: `user_id=eq.${this.userId}`,
        },
        async (payload) => {
          try {
            await this.handleTaskAssignment(payload.new as TaskAssignmentPayload);
          } catch (error) {
            console.error('Error handling assignment notification:', error);
          }
        }
      )
      .subscribe();

    this.channels.push(assignmentsChannel);

    // Channel 4: Task status changes (for tasks user is assigned to)
    const taskStatusChannel = this.supabase
      .channel('desktop-notifications-task-status')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'tasks',
        },
        async (payload) => {
          try {
            // Check if user is assigned to this task
            const { data: assignment } = await this.supabase
              .from('task_assignees')
              .select('user_id')
              .eq('task_id', payload.new.id)
              .eq('user_id', this.userId)
              .single();

            if (assignment) {
              await this.handleTaskStatusChange(
                payload.new as TaskPayload,
                payload.old as TaskPayload
              );
            }
          } catch (error) {
            console.error('Error handling task status notification:', error);
          }
        }
      )
      .subscribe();

    this.channels.push(taskStatusChannel);

    console.log('[DesktopNotifications] Subscribed to notification channels');
  }

  /**
   * Unsubscribe from all channels
   */
  async unsubscribe(): Promise<void> {
    for (const channel of this.channels) {
      await this.supabase.removeChannel(channel);
    }
    this.channels = [];
    this.userCache.clear();
    this.conversationCache.clear();
    this.taskCache.clear();
    console.log('[DesktopNotifications] Unsubscribed from notification channels');
  }
}

// Singleton instance
let notificationManager: DesktopNotificationManager | null = null;

/**
 * Initialize desktop notifications for the current user
 */
export function initializeDesktopNotifications(
  supabase: SupabaseClient<Database>,
  userId: string
): DesktopNotificationManager {
  // Clean up existing manager
  if (notificationManager) {
    notificationManager.unsubscribe();
  }

  notificationManager = new DesktopNotificationManager(supabase, userId);
  notificationManager.subscribe();
  return notificationManager;
}

/**
 * Clean up desktop notifications
 */
export function cleanupDesktopNotifications(): void {
  if (notificationManager) {
    notificationManager.unsubscribe();
    notificationManager = null;
  }
}
