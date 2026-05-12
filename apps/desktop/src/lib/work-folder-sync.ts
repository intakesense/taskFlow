/**
 * Work Folder Sync Engine
 *
 * Responsibilities:
 * - Listen for file system events from the Tauri watcher
 * - Debounce events per file (3s)
 * - Compute SHA-256 checksums and compare against manifest
 * - Feed changed files into the upload queue (max 2 concurrent)
 * - Handle remove events → archive in storage
 * - Notify user on failure (toast or OS notification)
 *
 * This module is stateless by itself — it reads/writes the Zustand store and
 * the Tauri Store plugin (manifest). Wire it up in App.tsx after auth succeeds.
 */

import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { load as loadStore } from '@tauri-apps/plugin-store';
import { toast } from 'sonner';
import { useWorkFolderStore, type FileQueueEntry } from '@/stores/work-folder';
import type { WorkFolderServiceInstance } from '@taskflow/features';

// ─── Constants ────────────────────────────────────────────────────────────────

const MANIFEST_STORE_KEY = 'work-folder-manifest';
const DEBOUNCE_MS = 3000;
const MAX_CONCURRENT = 2;
const MAX_RETRIES = 3;
const RETRY_DELAYS = [1000, 2000, 4000]; // ms
const MAX_FILE_BYTES = 500 * 1024 * 1024; // 500 MB — matches Supabase bucket policy

// ─── Blocklist ────────────────────────────────────────────────────────────────

const BLOCKED_EXTENSIONS = new Set([
  '.tmp', '.temp', '.lock', '.lck', '.part', '.swp', '.swo', '.crdownload',
]);

const BLOCKED_NAMES = new Set(['Thumbs.db', 'desktop.ini', 'DS_Store']);

function isBlocked(filePath: string): boolean {
  const name = filePath.split(/[\\/]/).pop() ?? '';
  if (name.startsWith('~$') || name.startsWith('.')) return true;
  if (BLOCKED_NAMES.has(name)) return true;
  const lower = name.toLowerCase();
  for (const ext of BLOCKED_EXTENSIONS) {
    if (lower.endsWith(ext)) return true;
  }
  return false;
}

// ─── Checksum ─────────────────────────────────────────────────────────────────

async function sha256(bytes: Uint8Array): Promise<string> {
  const hashBuffer = await crypto.subtle.digest('SHA-256', bytes);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

// ─── Manifest ─────────────────────────────────────────────────────────────────

interface ManifestEntry {
  localPath: string;
  storageKey: string;
  checksum: string;
  lastSyncedAt: string;
  status: 'synced' | 'archived';
}

// Lazily-resolved store handle — avoids re-opening the file on every read/write
let _storePromise: ReturnType<typeof loadStore> | null = null;

function getStoreHandle() {
  if (!_storePromise) {
    _storePromise = loadStore('taskflow-work-folder.json');
  }
  return _storePromise;
}

// In-memory manifest cache — eliminates redundant disk reads during active sync.
// Invalidated (set to null) only when the store handle is reset (stopSync).
let _manifestCache: Map<string, ManifestEntry> | null = null;

// Write-lock: serialises manifest writes so two concurrent uploads can't
// interleave their read-modify-write cycles and clobber each other's entry.
let _manifestWriteLock: Promise<void> = Promise.resolve();

async function getManifest(): Promise<Map<string, ManifestEntry>> {
  if (_manifestCache) return _manifestCache;
  const store = await getStoreHandle();
  const raw = await store.get<Record<string, ManifestEntry>>(MANIFEST_STORE_KEY);
  _manifestCache = raw ? new Map(Object.entries(raw)) : new Map();
  return _manifestCache;
}

async function setManifestEntry(entry: ManifestEntry): Promise<void> {
  // Chain onto the existing lock so writes are strictly serialised
  _manifestWriteLock = _manifestWriteLock.then(async () => {
    const manifest = await getManifest();
    manifest.set(entry.localPath, entry); // update cache in-place
    const store = await getStoreHandle();
    await store.set(MANIFEST_STORE_KEY, Object.fromEntries(manifest));
    await store.save();
  });
  await _manifestWriteLock;
}

function resetStoreHandle(): void {
  _storePromise = null;
  _manifestCache = null;
  _manifestWriteLock = Promise.resolve();
}

// ─── Notifications ────────────────────────────────────────────────────────────

/**
 * Route failure notifications per spec:
 *   - Window visible  → Sonner toast (in-app, non-intrusive)
 *   - Window in tray  → OS native notification (user must see it)
 * Never both — double-notify is annoying.
 */
async function notifyFailure(message: string): Promise<void> {
  let windowVisible = true;
  try {
    const { getCurrentWindow } = await import('@tauri-apps/api/window');
    windowVisible = await getCurrentWindow().isVisible();
  } catch {
    // Non-Tauri env or API not available — default to in-app toast
  }

  if (windowVisible) {
    toast.error(message, { duration: 8000 });
  } else {
    try {
      const { sendNotification } = await import('@tauri-apps/plugin-notification');
      await sendNotification({ title: 'Work Folder Sync Error', body: message });
    } catch {
      // OS notification plugin unavailable — fall back to toast as last resort
      toast.error(message, { duration: 8000 });
    }
  }
}

// ─── Tray status update ───────────────────────────────────────────────────────

async function updateTrayLabel(label: string): Promise<void> {
  try {
    await invoke('update_tray_work_folder_label', { label });
  } catch {
    // Best-effort — if command not available in older builds, skip
  }
}

// ─── Upload Queue ─────────────────────────────────────────────────────────────

let queueRunning = false;

async function drainQueue(
  userId: string,
  workFolderService: WorkFolderServiceInstance,
): Promise<void> {
  if (queueRunning) return;
  queueRunning = true;

  const store = useWorkFolderStore.getState;

  try {
    while (true) {
      const { activeUploads, dequeue, markActive, markInactive, setFileStatus } =
        store();

      // Wait until slot available
      if (activeUploads.size >= MAX_CONCURRENT) {
        await new Promise((r) => setTimeout(r, 500));
        continue;
      }

      const entry = dequeue();
      if (!entry) break;

      markActive(entry.absolutePath);
      setFileStatus(entry.absolutePath, { status: 'syncing', progress: 0 });

      // Tray update after markActive so the label reflects the new active count
      void updateTrayLabel(store().trayStatusLabel);

      // Update DB row to syncing (best-effort — row may not exist yet for new files)
      await workFolderService.markSyncing(userId, entry.storageKey);

      // Kick off upload in background — don't await here so queue loop continues
      uploadWithRetry(entry, userId, workFolderService).finally(() => {
        markInactive(entry.absolutePath);
        void updateTrayLabel(store().trayStatusLabel);
      });
    }
  } finally {
    // Only clear the gate after all fire-and-forget uploads have had a chance
    // to call markActive. We yield to the microtask queue first so any
    // Promise.resolve() in Zustand state updates have settled.
    await Promise.resolve();
    queueRunning = false;
    // Re-drain if new items arrived while this run was in flight.
    // Without this, an item enqueued just as the last dequeue() returned null
    // would sit stranded until the next watcher event.
    const { queue } = useWorkFolderStore.getState();
    if (queue.length > 0) {
      void drainQueue(userId, workFolderService);
    }
  }
}

async function uploadWithRetry(
  entry: FileQueueEntry,
  userId: string,
  workFolderService: WorkFolderServiceInstance,
): Promise<void> {
  // Pre-check: read metadata once before attempting any upload.
  // (1) Guards against OOM from oversized files before reading bytes into memory.
  // (2) Gives us size + mtime upfront so the retry loop doesn't re-fetch them.
  let fileMeta: { size: number; modified: string };
  try {
    fileMeta = await invoke('get_file_metadata', { path: entry.absolutePath });
  } catch {
    // get_file_metadata returns an error string for symlinks — those should be
    // blocked upstream, but skip gracefully if one somehow reaches here.
    return;
  }

  if (fileMeta.size > MAX_FILE_BYTES) {
    const mb = (fileMeta.size / (1024 * 1024)).toFixed(0);
    const limitMb = MAX_FILE_BYTES / (1024 * 1024);
    const msg = `${entry.fileName} is ${mb} MB — exceeds the ${limitMb} MB limit and will not be synced.`;
    await workFolderService.markFailed(userId, entry.storageKey, msg, 0);
    useWorkFolderStore.getState().setFileStatus(entry.absolutePath, { status: 'failed', error: msg });
    await notifyFailure(msg);
    return;
  }

  let lastError = '';

  // MAX_RETRIES = 3 means 3 total attempts (indices 0, 1, 2)
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      // Re-read file bytes on each attempt (file may have changed since metadata read)
      const bytes: number[] = await invoke('read_file_bytes', { path: entry.absolutePath });
      const uint8 = new Uint8Array(bytes);
      const blob = new Blob([uint8]);
      const checksum = await sha256(uint8);

      await workFolderService.uploadFile(
        {
          userId,
          fileName: entry.fileName,
          relativePath: entry.relativePath,
          storageKey: entry.storageKey,
          fileSizeBytes: fileMeta.size,
          checksum,
          lastModifiedAt: fileMeta.modified,
        },
        blob,
      );

      // Success
      await setManifestEntry({
        localPath: entry.absolutePath,
        storageKey: entry.storageKey,
        checksum,
        lastSyncedAt: new Date().toISOString(),
        status: 'synced',
      });

      useWorkFolderStore.getState().setFileStatus(entry.absolutePath, { status: 'synced', progress: 100 });
      return;
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);

      if (attempt < MAX_RETRIES - 1) {
        await new Promise((r) => setTimeout(r, RETRY_DELAYS[attempt]));
      }
    }
  }

  // All retries exhausted
  await workFolderService.markFailed(userId, entry.storageKey, lastError, MAX_RETRIES);
  useWorkFolderStore.getState().setFileStatus(entry.absolutePath, { status: 'failed', error: lastError });

  const fileName = entry.fileName;
  await notifyFailure(`${fileName} failed to sync. Check Settings → Work Folder to retry.`);
}

// ─── Per-file event processing ────────────────────────────────────────────────

const debounceTimers = new Map<string, ReturnType<typeof setTimeout>>();

async function handleFileEvent(
  absolutePath: string,
  eventKind: string,
  userId: string,
  folderPath: string,
  workFolderService: WorkFolderServiceInstance,
): Promise<void> {
  if (isBlocked(absolutePath)) return;

  if (eventKind === 'remove') {
    // Archive in storage — do not delete bytes
    const relativePath = toRelativePath(absolutePath, folderPath);
    const storageKey = `${userId}/${relativePath}`;
    try {
      await workFolderService.archiveFile(userId, storageKey);
      const manifest = await getManifest();
      const entry = manifest.get(absolutePath);
      if (entry) {
        await setManifestEntry({ ...entry, status: 'archived' });
      }
    } catch {
      // Archive failure is non-critical — file is already gone locally
    }
    return;
  }

  // Debounce create/modify/rename
  const existing = debounceTimers.get(absolutePath);
  if (existing) clearTimeout(existing);

  const timer = setTimeout(async () => {
    debounceTimers.delete(absolutePath);
    await processFile(absolutePath, userId, folderPath, workFolderService);
  }, DEBOUNCE_MS);

  debounceTimers.set(absolutePath, timer);
}

async function processFile(
  absolutePath: string,
  userId: string,
  folderPath: string,
  workFolderService: WorkFolderServiceInstance,
): Promise<void> {
  try {
    // Read bytes (may fail if file is locked — will be retried by queue)
    const bytes: number[] = await invoke('read_file_bytes', { path: absolutePath });
    const uint8 = new Uint8Array(bytes);
    const checksum = await sha256(uint8);

    // Check manifest
    const manifest = await getManifest();
    const existing = manifest.get(absolutePath);
    if (existing && existing.checksum === checksum && existing.status === 'synced') {
      return; // No change
    }

    const relativePath = toRelativePath(absolutePath, folderPath);
    const storageKey = `${userId}/${relativePath}`;
    const fileName = absolutePath.split(/[\\/]/).pop() ?? absolutePath;

    useWorkFolderStore.getState().enqueue({
      absolutePath,
      storageKey,
      relativePath,
      fileName,
      retryCount: 0,
    });

    void drainQueue(userId, workFolderService);
  } catch {
    // File may be temporarily locked — the watcher will re-fire on the next modification
  }
}

function toRelativePath(absolutePath: string, folderPath: string): string {
  // Normalize to forward slashes for both Windows and Unix
  const abs = absolutePath.replace(/\\/g, '/');
  const base = folderPath.replace(/\\/g, '/').replace(/\/$/, '');
  if (abs.startsWith(base + '/')) {
    return abs.slice(base.length + 1);
  }
  // Case-insensitive fallback for Windows paths (e.g., C:\ vs c:\)
  const absLower = abs.toLowerCase();
  const baseLower = base.toLowerCase();
  if (absLower.startsWith(baseLower + '/')) {
    return abs.slice(base.length + 1);
  }
  // Last resort: just the filename — avoids leaking full system paths into storage keys
  return abs.split('/').pop() ?? 'unknown';
}

// ─── Public API ───────────────────────────────────────────────────────────────

let unlistenFsEvent: UnlistenFn | null = null;
let unlistenWatcherError: UnlistenFn | null = null;
let unlistenWatcherStopped: UnlistenFn | null = null;
let unlistenOpenRequest: UnlistenFn | null = null;
let unlistenViewRequest: UnlistenFn | null = null;
let heartbeatInterval: ReturnType<typeof setInterval> | null = null;

interface StartSyncOptions {
  userId: string;
  folderPath: string;
  workFolderService: WorkFolderServiceInstance;
  onNavigateToSettings: () => void;
}

/**
 * Start the file watcher and register all event listeners.
 * Call this once per session after auth succeeds and folder is confirmed to exist.
 */
export async function startSync(options: StartSyncOptions): Promise<void> {
  const { userId, folderPath, workFolderService, onNavigateToSettings } = options;
  const store = useWorkFolderStore.getState();

  // Start watcher via Tauri
  await invoke('start_watcher', { folderPath });
  store.setWatcherRunning(true);

  // Update heartbeat in DB
  await workFolderService.updateWatcherHeartbeat(userId, true);

  // ── FS events ──────────────────────────────────────────────────────────────
  unlistenFsEvent = await listen<{ path: string; eventKind: string }>(
    'work-folder-event',
    async (event) => {
      await handleFileEvent(
        event.payload.path,
        event.payload.eventKind,
        userId,
        folderPath,
        workFolderService,
      );
    },
  );

  // ── Watcher error ──────────────────────────────────────────────────────────
  unlistenWatcherError = await listen<string>('work-folder-watcher-error', async (event) => {
    await notifyFailure(`Work folder watcher error: ${event.payload}`);
  });

  // ── Watcher stopped (folder may have moved) ────────────────────────────────
  unlistenWatcherStopped = await listen('work-folder-watcher-stopped', () => {
    store.setWatcherRunning(false);
    store.setFolderMissing(true);
    void notifyFailure(
      'Work folder watcher stopped. Open Settings → Work Folder to reconnect.',
    );
  });

  // ── Tray: open folder ──────────────────────────────────────────────────────
  unlistenOpenRequest = await listen('work-folder-open-request', () => {
    void invoke('open_folder_in_explorer', { path: folderPath });
  });

  // ── Tray: view status ──────────────────────────────────────────────────────
  unlistenViewRequest = await listen('work-folder-view-request', () => {
    onNavigateToSettings();
  });

  // ── Heartbeat: update watcher_active every 5 minutes ─────────────────────
  heartbeatInterval = setInterval(() => {
    void workFolderService.updateWatcherHeartbeat(userId, true);
  }, 5 * 60 * 1000);
}

/**
 * Stop the file watcher and clean up all listeners.
 * Called on sign-out or app teardown.
 */
export async function stopSync(
  userId?: string,
  workFolderService?: WorkFolderServiceInstance,
): Promise<void> {
  // Reset queue gate first — ensures a new session after sign-out can always drain
  queueRunning = false;

  try {
    await invoke('stop_watcher');
  } catch {
    // May already be stopped
  }

  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
    heartbeatInterval = null;
  }

  if (userId && workFolderService) {
    await workFolderService.updateWatcherHeartbeat(userId, false);
  }

  unlistenFsEvent?.();
  unlistenWatcherError?.();
  unlistenWatcherStopped?.();
  unlistenOpenRequest?.();
  unlistenViewRequest?.();
  unlistenFsEvent = null;
  unlistenWatcherError = null;
  unlistenWatcherStopped = null;
  unlistenOpenRequest = null;
  unlistenViewRequest = null;

  useWorkFolderStore.getState().setWatcherRunning(false);

  // Clear debounce timers
  for (const timer of debounceTimers.values()) clearTimeout(timer);
  debounceTimers.clear();

  // Reset store handle so next session re-opens cleanly
  resetStoreHandle();
}

/**
 * Manually retry all failed files — re-enqueues them.
 */
export async function retryFailed(
  userId: string,
  folderPath: string,
  workFolderService: WorkFolderServiceInstance,
): Promise<void> {
  const { fileStatuses, setFileStatus, enqueue } = useWorkFolderStore.getState();
  for (const [absolutePath, entry] of fileStatuses.entries()) {
    if (entry.status === 'failed') {
      setFileStatus(absolutePath, { status: 'pending' });
      const relativePath = toRelativePath(absolutePath, folderPath);
      const storageKey = `${userId}/${relativePath}`;
      const fileName = absolutePath.split(/[\\/]/).pop() ?? absolutePath;
      enqueue({ absolutePath, storageKey, relativePath, fileName, retryCount: 0 });
    }
  }
  void drainQueue(userId, workFolderService);
}
