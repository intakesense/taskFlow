'use client';

import { useState, useEffect, useCallback } from 'react';
import { Bell, BellOff } from 'lucide-react';
import { Switch, Separator, Button } from '@taskflow/ui';
import { SettingsSection, SettingsRow } from './settings-view';

export interface NotificationPreferences {
  enabled: boolean;
  sound: boolean;
  messages: boolean;
  tasks: boolean;
  progress: boolean;
  mentions: boolean;
}

export interface NotificationsSettingsProps {
  /**
   * Load the current notification state.
   * Return null if notifications are not supported on this platform.
   */
  onLoad: () => Promise<NotificationPreferences>;
  /** Called when the master push toggle changes */
  onToggle: (enabled: boolean) => Promise<void>;
  /** Called when any preference changes (sound, categories) */
  onPreferenceChange?: (key: keyof Omit<NotificationPreferences, 'enabled'>, value: boolean) => Promise<void>;
  /** If provided, a "Test" button is shown that calls this */
  onTest?: () => Promise<void>;
  /** If provided, an "Autostart" row is shown */
  autostart?: {
    enabled: boolean;
    onToggle: (enabled: boolean) => Promise<void>;
  };
  /**
   * Status string shown under the main toggle.
   * If omitted, a default message is derived from the enabled state.
   */
  statusMessage?: string;
  /**
   * Show the "notifications blocked in browser" error UI.
   * Pass true when Notification.permission === 'denied'.
   */
  blocked?: boolean;
}

export function NotificationsSettings({
  onLoad,
  onToggle,
  onPreferenceChange,
  onTest,
  autostart,
  statusMessage,
  blocked = false,
}: NotificationsSettingsProps) {
  const [prefs, setPrefs] = useState<NotificationPreferences>({
    enabled: false,
    sound: true,
    messages: true,
    tasks: true,
    progress: true,
    mentions: true,
  });
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);
  const [testSent, setTestSent] = useState(false);

  useEffect(() => {
    onLoad()
      .then(setPrefs)
      .catch(() => { /* keep defaults on load failure */ })
      .finally(() => setLoading(false));
  }, [onLoad]);

  const handleToggle = useCallback(async (enabled: boolean) => {
    if (blocked) return;
    setToggling(true);
    try {
      await onToggle(enabled);
      setPrefs((p) => ({ ...p, enabled }));
    } finally {
      setToggling(false);
    }
  }, [blocked, onToggle]);

  const handlePreference = useCallback(async (
    key: keyof Omit<NotificationPreferences, 'enabled'>,
    value: boolean,
  ) => {
    setPrefs((p) => ({ ...p, [key]: value }));
    await onPreferenceChange?.(key, value);
  }, [onPreferenceChange]);

  const handleTest = useCallback(async () => {
    setTestSent(true);
    try {
      await onTest?.();
    } finally {
      setTimeout(() => setTestSent(false), 3000);
    }
  }, [onTest]);

  const defaultStatus = prefs.enabled
    ? 'You will receive task updates and messages'
    : blocked
      ? 'Notifications are blocked in browser settings'
      : 'Enable to receive task updates';

  return (
    <>
      <SettingsSection
        title="Notifications"
        description="Manage notification preferences"
        icon={prefs.enabled ? <Bell className="h-5 w-5" /> : <BellOff className="h-5 w-5" />}
      >
        {/* Master toggle */}
        <SettingsRow
          label="Push Notifications"
          description={statusMessage ?? defaultStatus}
        >
          <div className="flex items-center gap-3">
            {onTest && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleTest}
                disabled={loading || testSent}
              >
                {testSent ? 'Sent!' : 'Test'}
              </Button>
            )}
            <Switch
              checked={prefs.enabled}
              onCheckedChange={handleToggle}
              disabled={loading || toggling || blocked}
            />
          </div>
        </SettingsRow>

        {/* Blocked in browser warning */}
        {blocked && (
          <div className="p-3 bg-destructive/10 rounded-lg border border-destructive/20">
            <p className="text-sm text-destructive">
              Notifications are blocked. To enable them:
            </p>
            <ol className="text-xs text-muted-foreground mt-2 list-decimal list-inside space-y-1">
              <li>Click the lock/info icon in your browser&apos;s address bar</li>
              <li>Find &quot;Notifications&quot; and change to &quot;Allow&quot;</li>
              <li>Refresh this page</li>
            </ol>
          </div>
        )}

        {/* Sound */}
        {onPreferenceChange && (
          <>
            <Separator />
            <SettingsRow
              label="Sound"
              description="Play sound when receiving notifications"
            >
              <Switch
                checked={prefs.sound}
                onCheckedChange={(v) => handlePreference('sound', v)}
                disabled={loading || !prefs.enabled}
              />
            </SettingsRow>
          </>
        )}

        {/* Autostart (desktop-only) */}
        {autostart && (
          <>
            <Separator />
            <SettingsRow
              label="Start on login"
              description="Launch TaskFlow when you log in"
            >
              <Switch
                checked={autostart.enabled}
                onCheckedChange={autostart.onToggle}
                disabled={loading}
              />
            </SettingsRow>
          </>
        )}
      </SettingsSection>

      {/* Notification categories — only shown when granular control is available */}
      {onPreferenceChange && (
        <SettingsSection
          title="Notification Types"
          description="Choose which notifications to receive"
          icon={<Bell className="h-5 w-5" />}
        >
          <SettingsRow label="Messages" description="New messages in conversations">
            <Switch
              checked={prefs.messages}
              onCheckedChange={(v) => handlePreference('messages', v)}
              disabled={loading || !prefs.enabled}
            />
          </SettingsRow>
          <Separator />
          <SettingsRow label="Task updates" description="Task assignments and status changes">
            <Switch
              checked={prefs.tasks}
              onCheckedChange={(v) => handlePreference('tasks', v)}
              disabled={loading || !prefs.enabled}
            />
          </SettingsRow>
          <Separator />
          <SettingsRow label="Progress updates" description="Task progress and comments">
            <Switch
              checked={prefs.progress}
              onCheckedChange={(v) => handlePreference('progress', v)}
              disabled={loading || !prefs.enabled}
            />
          </SettingsRow>
          <Separator />
          <SettingsRow label="Mentions" description="When someone @mentions you">
            <Switch
              checked={prefs.mentions}
              onCheckedChange={(v) => handlePreference('mentions', v)}
              disabled={loading || !prefs.enabled}
            />
          </SettingsRow>
        </SettingsSection>
      )}
    </>
  );
}
