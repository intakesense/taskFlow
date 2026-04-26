import { useCallback, useEffect, useState, useMemo } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '@/lib/query-client';
import { useAuthStore } from '@/stores/auth';
import { useAuthValue } from '@/lib/auth-adapter';
import { createDesktopLink } from '@/lib/desktop-link';
import { supabase } from '@/lib/supabase';
import { LoginPage } from '@/pages/Login';
import { DashboardPage } from '@/pages/Dashboard';
import { FeaturesProvider, BottomNavProvider, ThemeProvider } from '@taskflow/features';
import { MotionProvider } from '@/providers/motion-provider';
import { Toaster } from '@taskflow/ui';
import { useDesktopNotifications } from '@/hooks/use-desktop-notifications';
import { useAppUpdater } from '@/hooks/use-app-updater';
import { OfflineBanner } from '@/components/offline-banner';
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
  // Pass navigate callback for click-to-navigate functionality
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

  // Create stable Link component — reuse navigate so logic stays in one place
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
        <DashboardPage currentPath={currentPath} />
        <Toaster theme="dark" />
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
          {user ? <AppWithFeatures /> : <LoginPage />}
        </MotionProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
