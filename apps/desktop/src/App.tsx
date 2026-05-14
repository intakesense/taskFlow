import { useCallback, useEffect, useState, useMemo, useRef } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '@/lib/query-client';
import { useAuthStore } from '@/stores/auth';
import { useAuthValue } from '@/lib/auth-adapter';
import { createDesktopLink } from '@/lib/desktop-link';
import { supabase } from '@/lib/supabase';
import { LoginPage } from '@/pages/Login';
import { DashboardPage } from '@/pages/Dashboard';
import { FeaturesProvider, BottomNavProvider, ThemeProvider, createWorkFolderService } from '@taskflow/features';
import { MotionProvider } from '@/providers/motion-provider';
import { Toaster } from '@taskflow/ui';
import { useDesktopNotifications } from '@/hooks/use-desktop-notifications';
import { useAppUpdater } from '@/hooks/use-app-updater';
import { OfflineBanner } from '@/components/offline-banner';
import { WorkFolderSetup } from '@/components/WorkFolderSetup';
import { useWorkFolderStore } from '@/stores/work-folder';
import { startSync, stopSync } from '@/lib/work-folder-sync';
import { reconcileWorkFolder } from '@/lib/work-folder-reconcile';
import { load as loadStore } from '@tauri-apps/plugin-store';
import './index.css';

// Maximum history entries to prevent memory leaks
const MAX_HISTORY_LENGTH = 50;
const PATH_STORAGE_KEY = 'taskflow-current-path';
const HISTORY_STORAGE_KEY = 'taskflow-nav-history';

// Get initial path from localStorage or default to /tasks
function getInitialPath(): string {
  try {
    return localStorage.getItem(PATH_STORAGE_KEY) || '/tasks';
  } catch {
    return '/tasks';
  }
}

function getInitialHistory(): string[] {
  try {
    const stored = localStorage.getItem(HISTORY_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch {
    // Ignore parse errors
  }
  return [getInitialPath()];
}

function AppWithFeatures() {
  const auth = useAuthValue();
  const [currentPath, setCurrentPath] = useState(getInitialPath);
  const [history, setHistory] = useState<string[]>(getInitialHistory);

  // ── Work folder state ──────────────────────────────────────────────────────
  const [showSetup, setShowSetup] = useState(false);
  const workFolderStore = useWorkFolderStore();
  const syncInitialized = useRef(false);

  // Stable service instance (only recreated if supabase changes — it doesn't)
  const workFolderService = useMemo(() => createWorkFolderService(supabase), []);

  // Navigation handlers (defined before useDesktopNotifications)
  const navigate = useCallback((path: string) => {
    setHistory((prev) => {
      const newHistory = [...prev, path];
      return newHistory.length > MAX_HISTORY_LENGTH
        ? newHistory.slice(-MAX_HISTORY_LENGTH)
        : newHistory;
    });
    setCurrentPath(path);
  }, []);
  const goBack = useCallback(() => {
    setHistory((prev) => {
      if (prev.length <= 1) return prev;
      const newHistory = prev.slice(0, -1);
      setCurrentPath(newHistory[newHistory.length - 1]);
      return newHistory;
    });
  }, []);

  // Initialize desktop notifications for native OS notifications
  useDesktopNotifications({
    supabase,
    userId: auth.user?.id,
    onNavigate: navigate,
  });

  // Persist path changes to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(PATH_STORAGE_KEY, currentPath);
      localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(history));
    } catch {
      // Ignore storage errors
    }
  }, [currentPath, history]);

  // ── Work folder initialization ─────────────────────────────────────────────
  useEffect(() => {
    if (!auth.user || syncInitialized.current || !window.__TAURI_INTERNALS__) return;
    syncInitialized.current = true;

    void (async () => {
      try {
        const store = await loadStore('taskflow-work-folder.json');
        const configured = await store.get<boolean>('work-folder-configured');
        const savedPath = await store.get<string>('work-folder-path');

        if (!configured || !savedPath) {
          // First run — show setup modal
          setShowSetup(true);
          return;
        }

        // Verify folder still exists
        const { invoke } = await import('@tauri-apps/api/core');
        const folderExists: boolean = await invoke('check_folder_exists', { path: savedPath });

        let activePath = savedPath;

        if (!folderExists) {
          // Folder moved or renamed — scan Desktop for .taskflow-id marker
          const userId = auth.user!.id;
          const recovered: string | null = await invoke('find_work_folder_by_marker', { userId });

          if (recovered) {
            // Auto-relocate: update Tauri Store + DB silently
            console.info('[WorkFolder] Auto-relocated to:', recovered);
            const store = await loadStore('taskflow-work-folder.json');
            await store.set('work-folder-path', recovered);
            await store.save();
            await workFolderService.upsertConfig(userId, recovered);
            activePath = recovered;
          } else {
            // Truly gone (deleted or moved off Desktop) — show warning banner
            workFolderStore.setFolderMissing(true);
            workFolderStore.setFolderPath(savedPath);
            workFolderStore.setConfigured(true);
            return;
          }
        }

        workFolderStore.setFolderPath(activePath);
        workFolderStore.setConfigured(true);

        // Reconciliation pass
        const userId = auth.user!.id;
        await reconcileWorkFolder({
          userId,
          folderPath: activePath,
        });

        // Start file watcher (queue drains automatically inside startSync)
        await startSync({
          userId,
          folderPath: activePath,
          workFolderService,
          onNavigateToSettings: () => navigate('/settings'),
        });
      } catch (err) {
        console.error('[WorkFolder] Init error:', err);
      }
    })();

    return () => {
      const currentUserId = auth.user?.id;
      if (currentUserId) {
        void stopSync(currentUserId, workFolderService);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth.user?.id]);

  // ── After setup completes ──────────────────────────────────────────────────
  const handleSetupComplete = useCallback(
    async (folderPath: string) => {
      setShowSetup(false);
      workFolderStore.setFolderPath(folderPath);
      workFolderStore.setConfigured(true);

      // Reconcile (empty folder — instant)
      await reconcileWorkFolder({ userId: auth.user!.id, folderPath });

      // Start watcher
      await startSync({
        userId: auth.user!.id,
        folderPath,
        workFolderService,
        onNavigateToSettings: () => navigate('/settings'),
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [auth.user?.id, workFolderService, navigate],
  );

  // Create stable Link component
  const DesktopLink = useMemo(() => createDesktopLink(navigate), [navigate]);

  return (
    <FeaturesProvider
      navigation={{
        currentPath,
        navigate,
        goBack,
        Link: DesktopLink,
      }}
      supabase={supabase}
      auth={auth}
      config={{
        apiBaseUrl: import.meta.env.VITE_API_BASE_URL ?? '',
        googleApiKey: import.meta.env.VITE_GOOGLE_API_KEY ?? '',
        logoSrc: '/logo.png',
      }}
    >
      <BottomNavProvider>
        <OfflineBanner />
        <DashboardPage
          currentPath={currentPath}
          workFolderService={workFolderService}
        />
        <Toaster theme="dark" />

        {/* First-run setup modal — rendered on top of everything */}
        {showSetup && auth.user && (
          <WorkFolderSetup
            userId={auth.user.id}
            userFullName={auth.user.user_metadata?.full_name ?? auth.user.email ?? 'User'}
            workFolderService={workFolderService}
            onComplete={handleSetupComplete}
          />
        )}
      </BottomNavProvider>
    </FeaturesProvider>
  );
}


function App() {
  const { user, loading, initialized, initialize } = useAuthStore();

  // Check for updates on every launch, download silently, prompt restart when ready
  useAppUpdater();

  useEffect(() => {
    initialize();
  }, [initialize]);

  if (!initialized || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-muted-foreground text-sm">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <MotionProvider>
          {user ? <AppWithFeatures /> : (
            <>
              <LoginPage />
              <Toaster theme="dark" />
            </>
          )}
        </MotionProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
