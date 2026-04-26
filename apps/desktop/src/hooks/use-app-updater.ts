/**
 * useAppUpdater
 *
 * Checks for a new version once on mount (Tauri only).
 * Shows a toast with an install button; installs and relaunches on confirm.
 */

import { useEffect } from 'react';
import { toast } from 'sonner';

export function useAppUpdater() {
  useEffect(() => {
    if (!window.__TAURI_INTERNALS__) return;

    let cancelled = false;

    (async () => {
      try {
        const { check } = await import('@tauri-apps/plugin-updater');
        const { relaunch } = await import('@tauri-apps/plugin-process');

        const update = await check();
        if (cancelled || !update?.available) return;

        toast.info(`Update available — v${update.version}`, {
          description: update.body || 'A new version of TaskFlow is ready to install.',
          duration: Infinity,
          action: {
            label: 'Install & Restart',
            onClick: async () => {
              const installToast = toast.loading('Downloading update…');
              try {
                await update.downloadAndInstall();
                toast.dismiss(installToast);
                await relaunch();
              } catch {
                toast.dismiss(installToast);
                toast.error('Update failed. Please reinstall manually.');
              }
            },
          },
        });
      } catch {
        // Updater unavailable or network error — silent fail, not critical
      }
    })();

    return () => { cancelled = true; };
  }, []);
}
