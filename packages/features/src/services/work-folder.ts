import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@taskflow/core';
import type { StorageProvider } from './storage-providers/storage-provider.interface';
import { createSupabaseStorageProvider } from './storage-providers/supabase-storage-provider';

// ─── Types ────────────────────────────────────────────────────────────────────

export type WorkFolderFileStatus = 'synced' | 'syncing' | 'pending' | 'failed' | 'archived';

export interface WorkFolderFileRow {
  id: string;
  user_id: string;
  file_name: string;
  relative_path: string;
  storage_key: string;
  file_size_bytes: number | null;
  checksum: string | null;
  status: WorkFolderFileStatus;
  last_synced_at: string | null;
  last_modified_at: string | null;
  error_message: string | null;
  retry_count: number;
  created_at: string;
  archived_at: string | null;
}

export interface WorkFolderConfig {
  id: string;
  user_id: string;
  folder_path: string;
  storage_prefix: string;
  configured_at: string;
  last_watcher_start: string | null;
  watcher_active: boolean;
}

export interface UpsertFileInput {
  userId: string;
  fileName: string;
  relativePath: string;
  storageKey: string;
  fileSizeBytes: number;
  checksum: string;
  lastModifiedAt: string;
}

export interface WorkFolderService {
  /** Upload a file blob to storage and upsert the DB tracking row. */
  uploadFile(input: UpsertFileInput, blob: Blob): Promise<void>;
  /** Move a storage object to `_archive/` and mark DB row as archived. */
  archiveFile(userId: string, storageKey: string): Promise<void>;
  /** List all file rows for a user (admin or self). */
  listUserFiles(userId: string): Promise<WorkFolderFileRow[]>;
  /** Generate a 1-hour signed URL for a file (admin download). */
  getSignedUrl(storageKey: string): Promise<string>;
  /** Total bytes synced for a user (sum of synced rows). */
  getStorageUsage(userId: string): Promise<number>;
  /** Mark a file row as syncing before an upload attempt. */
  markSyncing(userId: string, storageKey: string): Promise<void>;
  /** Mark a file row as failed and record the error. */
  markFailed(userId: string, storageKey: string, error: string, retryCount: number): Promise<void>;
  /** Upsert the work folder config for a user. */
  upsertConfig(userId: string, folderPath: string): Promise<void>;
  /** Update watcher heartbeat (watcher_active + last_watcher_start). */
  updateWatcherHeartbeat(userId: string, active: boolean): Promise<void>;
  /** Get the config for the current user. */
  getConfig(userId: string): Promise<WorkFolderConfig | null>;
}

// ─── Factory ─────────────────────────────────────────────────────────────────

export function createWorkFolderService(
  supabase: SupabaseClient<Database>,
  storageProvider?: StorageProvider,
): WorkFolderService {
  // Default to SupabaseStorageProvider; swap via factory arg for future S3 migration
  const storage = storageProvider ?? createSupabaseStorageProvider(supabase);

  async function uploadFile(input: UpsertFileInput, blob: Blob): Promise<void> {
    const { userId, fileName, relativePath, storageKey, fileSizeBytes, checksum, lastModifiedAt } = input;

    // Upload to storage (upsert: true — always safe to re-upload)
    await storage.upload(storageKey, blob);

    // Upsert DB row
    const { error } = await supabase
      .from('work_folder_files')
      .upsert(
        {
          user_id: userId,
          file_name: fileName,
          relative_path: relativePath,
          storage_key: storageKey,
          file_size_bytes: fileSizeBytes,
          checksum,
          status: 'synced' as WorkFolderFileStatus,
          last_synced_at: new Date().toISOString(),
          last_modified_at: lastModifiedAt,
          error_message: null,
          retry_count: 0,
        },
        { onConflict: 'user_id,storage_key' },
      );
    if (error) throw new Error(`DB upsert failed: ${error.message}`);
  }

  async function archiveFile(userId: string, storageKey: string): Promise<void> {
    await storage.archive(storageKey);

    const { error } = await supabase
      .from('work_folder_files')
      .update({
        status: 'archived' as WorkFolderFileStatus,
        archived_at: new Date().toISOString(),
      })
      .eq('user_id', userId)
      .eq('storage_key', storageKey);
    if (error) throw new Error(`DB archive update failed: ${error.message}`);
  }

  async function listUserFiles(userId: string): Promise<WorkFolderFileRow[]> {
    const { data, error } = await supabase
      .from('work_folder_files')
      .select('*')
      .eq('user_id', userId)
      .order('relative_path', { ascending: true });
    if (error) throw new Error(`List files failed: ${error.message}`);
    return (data ?? []) as WorkFolderFileRow[];
  }

  async function getSignedUrl(storageKey: string): Promise<string> {
    return storage.getSignedUrl(storageKey, 3600); // 1-hour expiry
  }

  async function getStorageUsage(userId: string): Promise<number> {
    const { data, error } = await supabase
      .from('work_folder_files')
      .select('file_size_bytes')
      .eq('user_id', userId)
      .eq('status', 'synced');
    if (error) throw new Error(`Storage usage query failed: ${error.message}`);
    return (data ?? []).reduce((sum, row) => sum + (row.file_size_bytes ?? 0), 0);
  }

  async function markSyncing(userId: string, storageKey: string): Promise<void> {
    // Best-effort — row may not exist yet on first upload.
    // uploadFile's upsert is the authoritative status setter on success.
    const { error } = await supabase
      .from('work_folder_files')
      .update({ status: 'syncing' as WorkFolderFileStatus })
      .eq('user_id', userId)
      .eq('storage_key', storageKey);
    if (error) {
      console.warn('[WorkFolder] markSyncing failed (non-fatal):', error.message);
    }
  }

  async function markFailed(
    userId: string,
    storageKey: string,
    error: string,
    retryCount: number,
  ): Promise<void> {
    await supabase
      .from('work_folder_files')
      .update({
        status: 'failed' as WorkFolderFileStatus,
        error_message: error,
        retry_count: retryCount,
      })
      .eq('user_id', userId)
      .eq('storage_key', storageKey);
  }

  async function upsertConfig(userId: string, folderPath: string): Promise<void> {
    const { error } = await supabase
      .from('work_folder_configs')
      .upsert(
        {
          user_id: userId,
          folder_path: folderPath,
          storage_prefix: `${userId}/`,
          configured_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' },
      );
    if (error) throw new Error(`Config upsert failed: ${error.message}`);
  }

  async function updateWatcherHeartbeat(userId: string, active: boolean): Promise<void> {
    await supabase
      .from('work_folder_configs')
      .update({
        watcher_active: active,
        last_watcher_start: active ? new Date().toISOString() : undefined,
      })
      .eq('user_id', userId);
  }

  async function getConfig(userId: string): Promise<WorkFolderConfig | null> {
    const { data, error } = await supabase
      .from('work_folder_configs')
      .select('*')
      .eq('user_id', userId)
      .single();
    if (error && error.code !== 'PGRST116') {
      throw new Error(`Config fetch failed: ${error.message}`);
    }
    return data as WorkFolderConfig | null;
  }

  return {
    uploadFile,
    archiveFile,
    listUserFiles,
    getSignedUrl,
    getStorageUsage,
    markSyncing,
    markFailed,
    upsertConfig,
    updateWatcherHeartbeat,
    getConfig,
  };
}

export type WorkFolderServiceInstance = ReturnType<typeof createWorkFolderService>;
