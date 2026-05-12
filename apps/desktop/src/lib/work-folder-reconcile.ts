/**
 * Work Folder Reconciliation Pass
 *
 * Runs once on every app launch (before the watcher starts).
 * Walks the entire work folder, computes checksums, diffs against the local
 * manifest, and enqueues anything that has changed or is missing.
 *
 * The reconciliation pass is the safety net for "app was closed while files
 * were being edited." The real-time watcher catches everything else.
 */

import { invoke } from '@tauri-apps/api/core';
import { load as loadStore } from '@tauri-apps/plugin-store';
import { useWorkFolderStore } from '@/stores/work-folder';
// WorkFolderServiceInstance is not needed here: reconcile only enqueues.
// drainQueue (which uses the service) is called by App.tsx after reconcile returns.

// ─── Blocklist (mirrors work-folder-sync.ts) ──────────────────────────────────

const BLOCKED_EXTENSIONS = new Set([
  '.tmp', '.temp', '.lock', '.lck', '.part', '.swp', '.swo', '.crdownload',
]);

const BLOCKED_NAMES = new Set(['Thumbs.db', 'desktop.ini', 'DS_Store']);

function isBlocked(filePath: string): boolean {
  const name = filePath.replace(/\\/g, '/').split('/').pop() ?? '';
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

// ─── Manifest access ──────────────────────────────────────────────────────────
// NOTE: ManifestEntry and MANIFEST_STORE_KEY must stay in sync with work-folder-sync.ts.
// If you change the shape here, change it there too.

interface ManifestEntry {
  localPath: string;
  storageKey: string;
  checksum: string;
  lastSyncedAt: string;
  status: 'synced' | 'archived';
}

const MANIFEST_STORE_KEY = 'work-folder-manifest';

async function getManifest(): Promise<Map<string, ManifestEntry>> {
  const store = await loadStore('taskflow-work-folder.json');
  const raw = await store.get<Record<string, ManifestEntry>>(MANIFEST_STORE_KEY);
  if (!raw) return new Map();
  return new Map(Object.entries(raw));
}

// ─── Reconciliation pass ──────────────────────────────────────────────────────

interface ReconcileOptions {
  userId: string;
  folderPath: string;
  // Note: no workFolderService here by design.
  // Reconcile only builds the queue; drainQueue (called by App.tsx)
  // handles uploads and receives the service directly.
}

/**
 * Walk the work folder, diff against manifest, enqueue anything new/changed.
 * Returns the count of files queued.
 */
export async function reconcileWorkFolder(options: ReconcileOptions): Promise<number> {
  const { userId, folderPath } = options;
  const { enqueue } = useWorkFolderStore.getState();

  // Walk the full folder tree via Tauri command
  let allFiles: string[];
  try {
    allFiles = await invoke<string[]>('walk_directory', { dirPath: folderPath });
  } catch {
    // Folder may not exist yet (empty first run) or permission issue
    return 0;
  }

  const manifest = await getManifest();
  const normalizedBase = folderPath.replace(/\\/g, '/').replace(/\/$/, '');

  let queued = 0;

  for (const absolutePath of allFiles) {
    if (isBlocked(absolutePath)) continue;

    try {
      const bytes: number[] = await invoke('read_file_bytes', { path: absolutePath });
      const uint8 = new Uint8Array(bytes);
      const checksum = await sha256(uint8);

      const existing = manifest.get(absolutePath);
      if (existing && existing.checksum === checksum && existing.status === 'synced') {
        // Already synced, nothing changed
        continue;
      }

      // Derive relative path — normalize to forward slashes for Windows compat
      const abs = absolutePath.replace(/\\/g, '/');
      let relativePath: string;
      if (abs.startsWith(normalizedBase + '/')) {
        relativePath = abs.slice(normalizedBase.length + 1);
      } else if (abs.toLowerCase().startsWith(normalizedBase.toLowerCase() + '/')) {
        // Case-insensitive match for Windows drive letters
        relativePath = abs.slice(normalizedBase.length + 1);
      } else {
        // Last resort: just the filename
        relativePath = abs.split('/').pop() ?? 'unknown';
      }

      const storageKey = `${userId}/${relativePath}`;
      const fileName = abs.split('/').pop() ?? absolutePath;

      enqueue({ absolutePath, storageKey, relativePath, fileName, retryCount: 0 });
      queued++;
    } catch {
      // File may be locked or unreadable — skip; watcher will pick it up later
    }
  }

  return queued;
}
