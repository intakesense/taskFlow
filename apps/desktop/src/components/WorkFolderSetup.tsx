/**
 * WorkFolderSetup — First-run modal shown once when desktop app is installed.
 *
 * Non-dismissable by design. The user must choose a folder path and confirm
 * before the watcher can start. After confirming, the dialog upserts the
 * work_folder_configs row and writes to Tauri Store.
 */

import { useState, useCallback, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { load as loadStore } from '@tauri-apps/plugin-store';
import { toast } from 'sonner';
import { Folder, AlertTriangle, Loader2, CheckCircle2 } from 'lucide-react';
import type { WorkFolderServiceInstance } from '@taskflow/features';

// ─── Cloud-sync folder heuristic ─────────────────────────────────────────────

const CLOUD_SYNC_MARKERS = ['dropbox', 'onedrive', 'google drive', 'icloud', 'box'];

function detectsCloudSync(folderPath: string): string | null {
  const lower = folderPath.toLowerCase();
  for (const marker of CLOUD_SYNC_MARKERS) {
    if (lower.includes(marker)) return marker;
  }
  return null;
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface WorkFolderSetupProps {
  userId: string;
  userFullName: string;
  workFolderService: WorkFolderServiceInstance;
  /** Called when setup is complete with the chosen folder path. */
  onComplete: (folderPath: string) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function WorkFolderSetup({
  userId,
  userFullName,
  workFolderService,
  onComplete,
}: WorkFolderSetupProps) {
  // Pre-fill with Desktop path — the safe, visible default
  const [folderPath, setFolderPath] = useState<string>('');
  const [cloudWarning, setCloudWarning] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Resolve default path once on mount — useEffect prevents double-fire in StrictMode
  const resolveDefaultPath = useCallback(async () => {
    try {
      const safeName = userFullName.replace(/[<>:"/\\|?*]/g, '-');
      const desktopPath: string = await invoke('get_default_folder_path', {
        userName: safeName,
      });
      setFolderPath(desktopPath);
    } catch {
      // Fallback — user can still type/pick manually
    }
  }, [userFullName]);

  useEffect(() => {
    void resolveDefaultPath();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // run once on mount only

  const handleChooseDifferent = useCallback(async () => {
    try {
      // Use Rust pick_folder command (wraps native OS picker via tauri-plugin-dialog)
      const selected: string | null = await invoke('pick_folder');
      if (selected) {
        setFolderPath(selected);
        const marker = detectsCloudSync(selected);
        setCloudWarning(marker);
      }
    } catch {
      // Dialog cancelled or unavailable
    }
  }, []);

  const handleConfirm = useCallback(async () => {
    if (!folderPath.trim()) {
      setError('Please choose a folder path.');
      return;
    }
    setIsCreating(true);
    setError(null);
    try {
      // 1. Create folder via Tauri (idempotent — ok if already exists)
      await invoke('setup_work_folder', { path: folderPath });

      // 2. Write hidden .taskflow-id marker — lets the app auto-relocate
      //    the folder after an accidental rename or move (Desktop scan on startup)
      await invoke('write_marker_file', { folderPath, userId }).catch(() => {
        // Non-fatal — marker is best-effort; main setup still succeeds
      });

      // 3. Persist to Tauri Store
      const store = await loadStore('taskflow-work-folder.json');
      await store.set('work-folder-path', folderPath);
      await store.set('work-folder-configured', true);
      await store.save();

      // 4. Upsert DB config row
      await workFolderService.upsertConfig(userId, folderPath);

      // 5. Done — parent handles reconcile + watcher start
      onComplete(folderPath);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(`Failed to create work folder: ${msg}`);
      toast.error('Work folder setup failed', { description: msg });
    } finally {
      setIsCreating(false);
    }
  }, [folderPath, userId, workFolderService, onComplete]);

  return (
    // Full-screen overlay — non-dismissable (no onClose handler)
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div
        className="relative bg-card border border-border rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden"
        style={{ animation: 'fadeSlideIn 0.3s ease' }}
      >
        {/* Gradient accent strip */}
        <div className="h-1.5 w-full bg-gradient-to-r from-primary via-primary/80 to-primary/40" />

        <div className="p-8">
          {/* Icon + heading */}
          <div className="flex flex-col items-center text-center mb-6">
            <div className="h-16 w-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mb-4 shadow-inner">
              <Folder className="h-8 w-8 text-primary" />
            </div>
            <h2 className="text-2xl font-bold text-foreground">Set up your Work Folder</h2>
            <p className="text-sm text-muted-foreground mt-2 max-w-xs">
              Files placed in this folder are automatically backed up to your company account.
              No action needed after setup.
            </p>
          </div>

          {/* Path display */}
          <div className="mb-4">
            <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
              Folder Path
            </label>
            <div className="flex items-center gap-2 p-3 rounded-xl bg-muted/40 border border-border text-sm font-mono text-foreground break-all leading-relaxed min-h-[52px]">
              <Folder className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="flex-1">{folderPath || 'Resolving path…'}</span>
            </div>
          </div>

          {/* Cloud sync warning */}
          {cloudWarning && (
            <div className="mb-4 flex gap-2.5 items-start p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
              <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-300 leading-relaxed">
                This folder is inside <strong className="capitalize">{cloudWarning}</strong>.
                Two sync tools on the same folder can cause conflicts. You can still proceed.
              </p>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="mb-4 flex gap-2.5 items-start p-3 rounded-xl bg-destructive/10 border border-destructive/20">
              <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
              <p className="text-xs text-destructive leading-relaxed">{error}</p>
            </div>
          )}

          {/* Actions */}
          <div className="space-y-2.5">
            <button
              id="work-folder-confirm"
              onClick={handleConfirm}
              disabled={isCreating || !folderPath}
              className="w-full h-11 flex items-center justify-center gap-2 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-primary/20"
            >
              {isCreating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Creating…
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4" />
                  Create Work Folder
                </>
              )}
            </button>

            <button
              id="work-folder-choose-different"
              onClick={handleChooseDifferent}
              disabled={isCreating}
              className="w-full h-9 flex items-center justify-center gap-1.5 rounded-xl text-muted-foreground hover:text-foreground text-sm transition-colors disabled:opacity-50"
            >
              Choose a different location
            </button>
          </div>

          <p className="text-center text-[11px] text-muted-foreground/60 mt-5 leading-relaxed">
            Your files are encrypted in transit and stored privately.
            Only you and admins can access them.
          </p>
        </div>
      </div>

      <style>{`
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateY(12px) scale(0.97); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </div>
  );
}
