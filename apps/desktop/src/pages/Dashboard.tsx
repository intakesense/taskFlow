import {
  DashboardLayout,
  TasksContainer,
  TaskDetailContainer,
  CreateTaskDrawer,
  ProgressFeedSheet,
  SettingsView,
  AppearanceSettings,
  AIBotSettings,
  HrmsSettings,
  GoogleConnectionCard,
  NotificationsSettings,
  AboutSettings,
  WorkFolderSettings,
  type BotConfig,
  type NotificationPreferences,
  MessagesContainer,
  ChitChatContainer,
  VoiceChannelProvider,
  type WorkFolderServiceInstance,
} from '@taskflow/features';
import { FilePreview } from '@taskflow/ui';
import { useAuthStore } from '@/stores/auth';
import { useWorkFolderStore } from '@/stores/work-folder';
import { retryFailed } from '@/lib/work-folder-sync';
import { invoke } from '@tauri-apps/api/core';
import { load as loadStore } from '@tauri-apps/plugin-store';
import { startSync, stopSync } from '@/lib/work-folder-sync';
import { reconcileWorkFolder } from '@/lib/work-folder-reconcile';
import { toast } from 'sonner';
import { useCallback, useState, useMemo } from 'react';

// Supabase edge function URLs for Daily.co room/token (no dependency on web app being up)
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL ?? '';
const DAILY_ROOM_ENDPOINT = `${SUPABASE_URL}/functions/v1/daily-room`;
const DAILY_TOKEN_ENDPOINT = `${SUPABASE_URL}/functions/v1/daily-token`;

// Web app base URL for API routes that have no Edge Function equivalent (AI bot, HRMS)
const WEB_API_URL = import.meta.env.VITE_API_BASE_URL ?? '';

interface DashboardPageProps {
  currentPath: string;
  workFolderService?: WorkFolderServiceInstance;
}

export function DashboardPage({ currentPath, workFolderService }: DashboardPageProps) {
  const renderContent = () => {
    // Settings
    if (currentPath.startsWith('/settings')) {
      return <DesktopSettingsView workFolderService={workFolderService} />;
    }

    // Messages
    if (currentPath.startsWith('/chat') || currentPath.startsWith('/messages')) {
      return (
        <MessagesContainer
          renderFilePreview={(props) => (
            <FilePreview file={props.file} onRemove={props.onRemove} />
          )}
        />
      );
    }

    // ChitChat voice/video
    if (currentPath.startsWith('/chitchat')) {
      return <ChitChatContainer />;
    }

    // Task detail view - /tasks/:id
    const taskMatch = currentPath.match(/^\/tasks\/([a-f0-9-]+)$/i);
    if (taskMatch) {
      return <TaskDetailContainer taskId={taskMatch[1]} />;
    }

    // Tasks list with Kanban view (default for / and /tasks)
    return (
      <TasksContainer
        renderCreateTask={(props) => (
          <CreateTaskDrawer
            open={props.open}
            onOpenChange={props.onOpenChange}
            initialSelectedUserIds={props.initialSelectedUserIds}
          />
        )}
        renderProgressFeed={() => <ProgressFeedSheet />}
      />
    );
  };

  // VoiceChannelProvider wraps entire dashboard so voice persists across tab changes
  return (
    <VoiceChannelProvider roomEndpoint={DAILY_ROOM_ENDPOINT} tokenEndpoint={DAILY_TOKEN_ENDPOINT}>
      <DashboardLayout>
        {renderContent()}
      </DashboardLayout>
    </VoiceChannelProvider>
  );
}

function DesktopSettingsView({ workFolderService }: { workFolderService?: WorkFolderServiceInstance }) {
  const { signOut, profile, session } = useAuthStore();
  const isAdmin = profile?.is_admin ?? false;
  const [isSigningOut, setIsSigningOut] = useState(false);

  // ── Work Folder ───────────────────────────────────────────────────────
  const {
    trayState,
    watcherRunning,
    isConfigured,
    folderPath,
    failedCount,
    fileStatuses,
    setFolderPath,
    setConfigured,
    setWatcherRunning,
    setFolderMissing,
  } = useWorkFolderStore();

  // Build a relative_path → live status map so WorkFolderSettings can show
  // progress bars for in-flight uploads without needing Zustand directly.
  // fileStatuses is keyed by absolutePath; derive relative_path by stripping folderPath.
  const localStatuses = useMemo(() => {
    if (!folderPath) return undefined;
    const map = new Map<string, { status: 'syncing' | 'pending'; progress?: number }>();
    const base = folderPath.replace(/\\/g, '/').replace(/\/$/, '');
    for (const [absPath, entry] of fileStatuses.entries()) {
      if (entry.status !== 'syncing' && entry.status !== 'pending') continue;
      const abs = absPath.replace(/\\/g, '/');
      let rel: string;
      if (abs.toLowerCase().startsWith(base.toLowerCase() + '/')) {
        rel = abs.slice(base.length + 1);
      } else {
        rel = abs.split('/').pop() ?? abs;
      }
      map.set(rel, { status: entry.status, progress: entry.progress });
    }
    return map.size > 0 ? map : undefined;
  }, [fileStatuses, folderPath]);

  const handleRetryAll = useCallback(async () => {
    if (!profile?.id || !folderPath || !workFolderService) return;
    await retryFailed(profile.id, folderPath, workFolderService);
  }, [profile?.id, folderPath, workFolderService]);

  const handleOpenFolder = useCallback(async () => {
    if (!folderPath) return;
    try {
      await invoke('open_folder_in_explorer', { path: folderPath });
    } catch {
      toast.error('Could not open folder.');
    }
  }, [folderPath]);

  const handleChangeLocation = useCallback(async () => {
    try {
      // Use Rust pick_folder command (wraps native OS picker via tauri-plugin-dialog)
      const selected: string | null = await invoke('pick_folder');
      if (!selected) return;
      if (!profile?.id || !workFolderService) return;

      // Stop existing watcher
      await stopSync(profile.id, workFolderService);

      // Verify path exists
      await invoke('check_folder_exists', { path: selected });

      // Persist new path
      const store = await loadStore('taskflow-work-folder.json');
      await store.set('work-folder-path', selected);
      await store.save();

      await workFolderService.upsertConfig(profile.id, selected);

      setFolderPath(selected);
      setFolderMissing(false);

      // Reconcile + restart
      await reconcileWorkFolder({ userId: profile.id, folderPath: selected });
      await startSync({
        userId: profile.id,
        folderPath: selected,
        workFolderService,
        onNavigateToSettings: () => {},
      });

      toast.success('Work folder location updated.');
    } catch {
      toast.error('Could not update work folder location.');
    }
  }, [profile?.id, workFolderService, setFolderPath, setFolderMissing]);

  const handleRemoveSync = useCallback(async () => {
    if (!profile?.id || !workFolderService) return;
    await stopSync(profile.id, workFolderService);
    const store = await loadStore('taskflow-work-folder.json');
    await store.delete('work-folder-configured');
    await store.delete('work-folder-path');
    await store.save();
    setConfigured(false);
    setWatcherRunning(false);
  }, [profile?.id, workFolderService, setConfigured, setWatcherRunning]);

  const handleSignOut = useCallback(async () => {
    setIsSigningOut(true);
    try {
      await signOut();
    } finally {
      setIsSigningOut(false);
    }
  }, [signOut]);

  // Auth header for web API calls from the desktop (bearer token instead of cookies)
  const authHeaders = useMemo(() => ({
    'Content-Type': 'application/json',
    ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
  }), [session?.access_token]);

  // ── Notifications ─────────────────────────────────────────────────────
  const [autostart, setAutostart] = useState(true);

  const handleLoadNotifications = useCallback(async (): Promise<NotificationPreferences> => {
    const get = (key: string, fallback = true) => {
      const v = localStorage.getItem(key);
      return v === null ? fallback : v !== 'false';
    };

    // Load real autostart state from Tauri on first load
    if (window.__TAURI_INTERNALS__) {
      try {
        const { isEnabled, enable } = await import('@tauri-apps/plugin-autostart');
        const enabled = await isEnabled();
        if (!enabled && !localStorage.getItem('taskflow-autostart-initialized')) {
          await enable();
          localStorage.setItem('taskflow-autostart-initialized', 'true');
          setAutostart(true);
        } else {
          setAutostart(enabled);
        }
      } catch { /* non-Tauri env */ }
    }

    return {
      enabled: get('taskflow-notifications-enabled'),
      sound: get('taskflow-sound-enabled'),
      messages: get('taskflow-message-notifications'),
      tasks: get('taskflow-task-notifications'),
      progress: get('taskflow-progress-notifications'),
      mentions: get('taskflow-mention-notifications'),
    };
  }, []);

  const handleNotificationToggle = useCallback(async (enabled: boolean) => {
    localStorage.setItem('taskflow-notifications-enabled', String(enabled));
  }, []);

  const handleNotificationPreference = useCallback(async (
    key: keyof Omit<NotificationPreferences, 'enabled'>,
    value: boolean,
  ) => {
    const storageKeyMap: Record<string, string> = {
      sound: 'taskflow-sound-enabled',
      messages: 'taskflow-message-notifications',
      tasks: 'taskflow-task-notifications',
      progress: 'taskflow-progress-notifications',
      mentions: 'taskflow-mention-notifications',
    };
    localStorage.setItem(storageKeyMap[key], String(value));
  }, []);

  const handleTestNotification = useCallback(async () => {
    if (window.__TAURI_INTERNALS__) {
      const { sendNotification } = await import('@tauri-apps/plugin-notification');
      await sendNotification({
        title: 'TaskFlow Notifications',
        body: 'Notifications are working! You will receive alerts for messages, tasks, and updates.',
        autoCancel: true,
      });
    }
  }, []);

  const handleAutostartToggle = useCallback(async (enabled: boolean) => {
    if (!window.__TAURI_INTERNALS__) return;
    const { enable, disable } = await import('@tauri-apps/plugin-autostart');
    if (enabled) {
      await enable();
    } else {
      await disable();
    }
    setAutostart(enabled);
  }, []);

  // ── Updater ───────────────────────────────────────────────────────────
  const handleCheckUpdate = useCallback(async () => {
    if (!window.__TAURI_INTERNALS__) return;
    try {
      const { check } = await import('@tauri-apps/plugin-updater');
      const { relaunch } = await import('@tauri-apps/plugin-process');
      const update = await check();
      if (!update?.available) {
        toast.success('You\'re up to date!', { description: `v${update?.currentVersion ?? '0.1.0'} is the latest version.` });
        return;
      }
      const id = toast.loading(`Downloading v${update.version}…`);
      try {
        await update.download();
        toast.dismiss(id);
        toast.info(`v${update.version} ready to install`, {
          description: 'Restart TaskFlow to apply the update.',
          duration: Infinity,
          action: {
            label: 'Restart Now',
            onClick: async () => {
              await update.install();
              await relaunch();
            },
          },
        });
      } catch {
        toast.dismiss(id);
        toast.error('Download failed. Check your connection.');
      }
    } catch {
      toast.error('Could not check for updates. Check your connection.');
    }
  }, []);

  // ── AI Bot ────────────────────────────────────────────────────────────
  const handleLoadBotConfig = useCallback(async (): Promise<BotConfig> => {
    const res = await fetch(`${WEB_API_URL}/api/ai/bot/config`, { headers: authHeaders });
    if (!res.ok) throw new Error('Failed to load config');
    return res.json();
  }, [authHeaders]);

  const handleSaveBotConfig = useCallback(async (config: BotConfig) => {
    const res = await fetch(`${WEB_API_URL}/api/ai/bot/config`, {
      method: 'PUT',
      headers: authHeaders,
      body: JSON.stringify(config),
    });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || 'Failed to save settings');
    }
  }, [authHeaders]);

  // ── HRMS ──────────────────────────────────────────────────────────────
  const handleFetchHrmsStatus = useCallback(async () => {
    const res = await fetch(`${WEB_API_URL}/api/hrms/status`, { headers: authHeaders });
    if (!res.ok) throw new Error('Failed to fetch status');
    return res.json();
  }, [authHeaders]);

  const handleUnlinkHrms = useCallback(async () => {
    const res = await fetch(`${WEB_API_URL}/api/hrms/link`, { method: 'DELETE', headers: authHeaders });
    if (!res.ok) throw new Error('Failed to unlink HRMS account');
  }, [authHeaders]);

  return (
    <SettingsView onSignOut={handleSignOut} isSigningOut={isSigningOut}>
      <AppearanceSettings />

      {isAdmin && (
        <AIBotSettings
          onLoadConfig={handleLoadBotConfig}
          onSaveConfig={handleSaveBotConfig}
        />
      )}

      <HrmsSettings
        onFetchStatus={handleFetchHrmsStatus}
        onUnlink={handleUnlinkHrms}
        apiBaseUrl={import.meta.env.VITE_API_BASE_URL ?? ''}
      />

      <GoogleConnectionCard />

      <NotificationsSettings
        onLoad={handleLoadNotifications}
        onToggle={handleNotificationToggle}
        onPreferenceChange={handleNotificationPreference}
        onTest={handleTestNotification}
        autostart={{ enabled: autostart, onToggle: handleAutostartToggle }}
      />

      <WorkFolderSettings
        syncStatus={trayState}
        watcherRunning={watcherRunning}
        isConfigured={isConfigured}
        folderPath={folderPath}
        failedCount={failedCount}
        localStatuses={localStatuses}
        onRetryAll={handleRetryAll}
        onOpenFolder={handleOpenFolder}
        onChangeLocation={handleChangeLocation}
        onRemoveSync={handleRemoveSync}
      />

      <AboutSettings
        version="0.1.0"
        platform="Desktop (Tauri)"
        buildMode={import.meta.env.MODE === 'production' ? 'Release' : 'Development'}
        onCheckUpdate={handleCheckUpdate}
      />
    </SettingsView>
  );
}
