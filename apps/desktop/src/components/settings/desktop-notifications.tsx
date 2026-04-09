import { useState, useEffect } from 'react';
import { Bell } from 'lucide-react';
import { Switch, Separator, Button } from '@taskflow/ui';
import { SettingsSection, SettingsRow } from '@taskflow/features';

// Storage keys for notification preferences
const STORAGE_KEYS = {
  notifications: 'taskflow-notifications-enabled',
  sound: 'taskflow-sound-enabled',
  autostartInit: 'taskflow-autostart-initialized',
  // Granular notification types
  messageNotifications: 'taskflow-message-notifications',
  taskNotifications: 'taskflow-task-notifications',
  progressNotifications: 'taskflow-progress-notifications',
  mentionNotifications: 'taskflow-mention-notifications',
} as const;

/**
 * Desktop-specific notification settings.
 * Handles native desktop notifications, sound, and startup options.
 */
export function DesktopNotificationsSettings() {
  const [autostart, setAutostart] = useState(true);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [messageNotifications, setMessageNotifications] = useState(true);
  const [taskNotifications, setTaskNotifications] = useState(true);
  const [progressNotifications, setProgressNotifications] = useState(true);
  const [mentionNotifications, setMentionNotifications] = useState(true);
  const [loading, setLoading] = useState(true);
  const [testingSent, setTestingSent] = useState(false);

  // Load all settings on mount
  useEffect(() => {
    const initSettings = async () => {
      // Load notification preferences from localStorage
      const savedNotifications = localStorage.getItem(STORAGE_KEYS.notifications);
      const savedSound = localStorage.getItem(STORAGE_KEYS.sound);
      const savedMessages = localStorage.getItem(STORAGE_KEYS.messageNotifications);
      const savedTasks = localStorage.getItem(STORAGE_KEYS.taskNotifications);
      const savedProgress = localStorage.getItem(STORAGE_KEYS.progressNotifications);
      const savedMentions = localStorage.getItem(STORAGE_KEYS.mentionNotifications);

      setNotificationsEnabled(savedNotifications !== 'false');
      setSoundEnabled(savedSound !== 'false');
      setMessageNotifications(savedMessages !== 'false');
      setTaskNotifications(savedTasks !== 'false');
      setProgressNotifications(savedProgress !== 'false');
      setMentionNotifications(savedMentions !== 'false');

      // Load autostart state (only in Tauri environment)
      try {
        // Check if running in Tauri
        if (!window.__TAURI_INTERNALS__) {
          setLoading(false);
          return;
        }
        const { isEnabled, enable } = await import('@tauri-apps/plugin-autostart');
        const enabled = await isEnabled();

        // Enable autostart by default on first run
        if (!enabled) {
          const hasInitialized = localStorage.getItem(STORAGE_KEYS.autostartInit);
          if (!hasInitialized) {
            await enable();
            localStorage.setItem(STORAGE_KEYS.autostartInit, 'true');
            setAutostart(true);
          } else {
            setAutostart(false);
          }
        } else {
          setAutostart(true);
        }
      } catch (e) {
        console.error('Autostart init error:', e);
      } finally {
        setLoading(false);
      }
    };

    initSettings();
  }, []);

  const handleNotificationsChange = (checked: boolean) => {
    setNotificationsEnabled(checked);
    localStorage.setItem(STORAGE_KEYS.notifications, String(checked));
  };

  const handleSoundChange = (checked: boolean) => {
    setSoundEnabled(checked);
    localStorage.setItem(STORAGE_KEYS.sound, String(checked));
  };

  const handleMessageNotificationsChange = (checked: boolean) => {
    setMessageNotifications(checked);
    localStorage.setItem(STORAGE_KEYS.messageNotifications, String(checked));
  };

  const handleTaskNotificationsChange = (checked: boolean) => {
    setTaskNotifications(checked);
    localStorage.setItem(STORAGE_KEYS.taskNotifications, String(checked));
  };

  const handleProgressNotificationsChange = (checked: boolean) => {
    setProgressNotifications(checked);
    localStorage.setItem(STORAGE_KEYS.progressNotifications, String(checked));
  };

  const handleMentionNotificationsChange = (checked: boolean) => {
    setMentionNotifications(checked);
    localStorage.setItem(STORAGE_KEYS.mentionNotifications, String(checked));
  };

  const handleTestNotification = async () => {
    setTestingSent(true);
    // Temporarily enable notifications for test
    const wasEnabled = notificationsEnabled;
    if (!wasEnabled) {
      localStorage.setItem(STORAGE_KEYS.notifications, 'true');
    }

    // Force show notification even if window is focused
    try {
      if (window.__TAURI_INTERNALS__) {
        const { sendNotification } = await import('@tauri-apps/plugin-notification');
        await sendNotification({
          title: 'TaskFlow Notifications',
          body: 'Notifications are working! You will receive alerts for messages, tasks, and updates.',
          autoCancel: true,
        });
      }
    } catch (error) {
      console.error('Test notification failed:', error);
    }

    // Restore previous state
    if (!wasEnabled) {
      localStorage.setItem(STORAGE_KEYS.notifications, 'false');
    }

    setTimeout(() => setTestingSent(false), 3000);
  };

  const handleAutostartChange = async (checked: boolean) => {
    // Only available in Tauri environment
    if (!window.__TAURI_INTERNALS__) return;

    try {
      const { enable, disable } = await import('@tauri-apps/plugin-autostart');
      if (checked) {
        await enable();
      } else {
        await disable();
      }
      setAutostart(checked);
    } catch (e) {
      console.error('Autostart toggle error:', e);
    }
  };

  return (
    <>
      <SettingsSection
        title="Notifications"
        description="Desktop notification preferences"
        icon={<Bell className="h-5 w-5" />}
      >
        <SettingsRow
          label="Desktop notifications"
          description="Show native desktop notifications"
        >
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={handleTestNotification}
              disabled={loading || testingSent}
            >
              {testingSent ? 'Sent!' : 'Test'}
            </Button>
            <Switch
              id="desktop-notif"
              checked={notificationsEnabled}
              onCheckedChange={handleNotificationsChange}
              disabled={loading}
            />
          </div>
        </SettingsRow>

        <Separator />

        <SettingsRow
          label="Sound"
          description="Play sound when receiving notifications"
        >
          <Switch
            id="sound-notif"
            checked={soundEnabled}
            onCheckedChange={handleSoundChange}
            disabled={loading || !notificationsEnabled}
          />
        </SettingsRow>

        <Separator />

        <SettingsRow
          label="Start on login"
          description="Launch TaskFlow when you log in"
        >
          <Switch
            id="startup"
            checked={autostart}
            onCheckedChange={handleAutostartChange}
            disabled={loading}
          />
        </SettingsRow>
      </SettingsSection>

      {/* Notification Categories */}
      <SettingsSection
        title="Notification Types"
        description="Choose which notifications to receive"
        icon={<Bell className="h-5 w-5" />}
      >
        <SettingsRow
          label="Messages"
          description="New messages in conversations"
        >
          <Switch
            id="message-notif"
            checked={messageNotifications}
            onCheckedChange={handleMessageNotificationsChange}
            disabled={loading || !notificationsEnabled}
          />
        </SettingsRow>

        <Separator />

        <SettingsRow
          label="Task updates"
          description="Task assignments and status changes"
        >
          <Switch
            id="task-notif"
            checked={taskNotifications}
            onCheckedChange={handleTaskNotificationsChange}
            disabled={loading || !notificationsEnabled}
          />
        </SettingsRow>

        <Separator />

        <SettingsRow
          label="Progress updates"
          description="Task progress and comments"
        >
          <Switch
            id="progress-notif"
            checked={progressNotifications}
            onCheckedChange={handleProgressNotificationsChange}
            disabled={loading || !notificationsEnabled}
          />
        </SettingsRow>

        <Separator />

        <SettingsRow
          label="Mentions"
          description="When someone @mentions you"
        >
          <Switch
            id="mention-notif"
            checked={mentionNotifications}
            onCheckedChange={handleMentionNotificationsChange}
            disabled={loading || !notificationsEnabled}
          />
        </SettingsRow>
      </SettingsSection>
    </>
  );
}
