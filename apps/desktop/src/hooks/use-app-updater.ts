/**
 * useAppUpdater
 *
 * Runs on every app launch (in the root App component, outside auth).
 * - Checks for update silently
 * - Downloads in the background with no user interaction
 * - Once ready, shows a persistent "Restart to update" toast
 *
 * User only has to click restart — never has to wait for a download.
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

        // Download silently in the background — no toast yet
        await update.download();
        if (cancelled) return;

        // Download complete — now prompt to restart (persistent, dismissible)
        toast.info(`TaskFlow v${update.version} is ready`, {
          description: 'Downloaded in the background. Restart to apply the update.',
          duration: Infinity,
          action: {
            label: 'Restart Now',
            onClick: async () => {
              try {
                await update.install();
                await relaunch();
              } catch {
                toast.error('Restart failed. Please close and reopen TaskFlow.');
              }
            },
          },
        });
      } catch {
        // Network error, updater unavailable — silent fail, not critical
      }
    })();

    return () => { cancelled = true; };
  }, []);
}
