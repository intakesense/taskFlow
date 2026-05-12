import { create } from 'zustand';
import type { WorkFolderFileStatus } from '@taskflow/features';

// ─── Types ────────────────────────────────────────────────────────────────────

export type TrayState = 'synced' | 'syncing' | 'queued' | 'failed' | 'offline';

export interface FileQueueEntry {
  absolutePath: string;
  storageKey: string;
  relativePath: string;
  fileName: string;
  retryCount: number;
}

export interface FileStatusEntry {
  status: WorkFolderFileStatus;
  error?: string;
  progress?: number;
}

interface WorkFolderState {
  // ── Folder config ────────────────────────────────────────────────────────
  folderPath: string | null;
  isConfigured: boolean;
  folderMissing: boolean;

  // ── Queue ────────────────────────────────────────────────────────────────
  queue: FileQueueEntry[];
  activeUploads: Set<string>; // absolute paths currently uploading

  // ── Per-file status ──────────────────────────────────────────────────────
  fileStatuses: Map<string, FileStatusEntry>; // keyed by absolute path

  // ── Watcher ──────────────────────────────────────────────────────────────
  watcherRunning: boolean;

  // ── Computed tray state ───────────────────────────────────────────────────
  trayState: TrayState;
  failedCount: number;

  // ── Actions ───────────────────────────────────────────────────────────────
  setFolderPath: (path: string) => void;
  setConfigured: (configured: boolean) => void;
  setFolderMissing: (missing: boolean) => void;
  setWatcherRunning: (running: boolean) => void;
  enqueue: (entry: FileQueueEntry) => void;
  dequeue: () => FileQueueEntry | null;
  markActive: (absolutePath: string) => void;
  markInactive: (absolutePath: string) => void;
  setFileStatus: (absolutePath: string, entry: FileStatusEntry) => void;
  clearFileStatus: (absolutePath: string) => void;
  recomputeTrayState: () => void;
  /** Update tray status label string (emitted to Rust via event). */
  trayStatusLabel: string;
  reset: () => void;
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const useWorkFolderStore = create<WorkFolderState>()((set, get) => ({
  folderPath: null,
  isConfigured: false,
  folderMissing: false,
  queue: [],
  activeUploads: new Set(),
  fileStatuses: new Map(),
  watcherRunning: false,
  trayState: 'synced',
  failedCount: 0,
  trayStatusLabel: 'Work Folder: All synced ✓',

  setFolderPath: (path) => set({ folderPath: path }),

  setConfigured: (configured) => set({ isConfigured: configured }),

  setFolderMissing: (missing) => {
    set({ folderMissing: missing });
    get().recomputeTrayState();
  },

  setWatcherRunning: (running) => {
    set({ watcherRunning: running });
    get().recomputeTrayState();
  },

  enqueue: (entry) => {
    set((state) => {
      // De-duplicate: don't add if already queued for same path
      const exists = state.queue.some((e) => e.absolutePath === entry.absolutePath);
      if (exists) return state;
      return { queue: [...state.queue, entry] };
    });
    get().recomputeTrayState();
  },

  dequeue: () => {
    const { queue } = get();
    if (queue.length === 0) return null;
    const [next, ...rest] = queue;
    set({ queue: rest });
    return next;
  },

  markActive: (absolutePath) => {
    set((state) => {
      const next = new Set(state.activeUploads);
      next.add(absolutePath);
      return { activeUploads: next };
    });
    get().recomputeTrayState();
  },

  markInactive: (absolutePath) => {
    set((state) => {
      const next = new Set(state.activeUploads);
      next.delete(absolutePath);
      return { activeUploads: next };
    });
    get().recomputeTrayState();
  },

  setFileStatus: (absolutePath, entry) => {
    set((state) => {
      const next = new Map(state.fileStatuses);
      next.set(absolutePath, entry);
      return { fileStatuses: next };
    });
    get().recomputeTrayState();
  },

  clearFileStatus: (absolutePath) => {
    set((state) => {
      const next = new Map(state.fileStatuses);
      next.delete(absolutePath);
      return { fileStatuses: next };
    });
    get().recomputeTrayState();
  },

  recomputeTrayState: () => {
    const { activeUploads, queue, fileStatuses, folderMissing, watcherRunning, isConfigured } = get();

    let trayState: TrayState;
    let failedCount = 0;

    for (const entry of fileStatuses.values()) {
      if (entry.status === 'failed') failedCount++;
    }

    if (isConfigured && (folderMissing || !watcherRunning)) {
      trayState = 'failed';
    } else if (activeUploads.size > 0) {
      trayState = 'syncing';
    } else if (queue.length > 0) {
      trayState = 'queued';
    } else if (failedCount > 0) {
      trayState = 'failed';
    } else {
      trayState = 'synced';
    }

    let trayStatusLabel: string;
    if (trayState === 'synced') {
      trayStatusLabel = 'Work Folder: All synced ✓';
    } else if (trayState === 'syncing') {
      trayStatusLabel = `Work Folder: Syncing… (${activeUploads.size} active)`;
    } else if (trayState === 'queued') {
      trayStatusLabel = `Work Folder: ${queue.length} file${queue.length === 1 ? '' : 's'} queued`;
    } else if (failedCount > 0) {
      trayStatusLabel = `Work Folder: ${failedCount} file${failedCount === 1 ? '' : 's'} failed`;
    } else {
      trayStatusLabel = 'Work Folder: Offline';
    }

    set({ trayState, failedCount, trayStatusLabel });
  },

  reset: () =>
    set({
      folderPath: null,
      isConfigured: false,
      folderMissing: false,
      queue: [],
      activeUploads: new Set(),
      fileStatuses: new Map(),
      watcherRunning: false,
      trayState: 'synced',
      failedCount: 0,
      trayStatusLabel: 'Work Folder: All synced ✓',
    }),
}));
