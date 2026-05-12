import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@taskflow/core';
import type { StorageProvider, StorageObject } from './storage-provider.interface';

const BUCKET = 'work-files';

/**
 * SupabaseStorageProvider — implements StorageProvider against Supabase Storage.
 *
 * Migration path: if STORAGE_PROVIDER=s3 is ever set, swap this for S3StorageProvider.
 * The `archive` method moves files to `_archive/` prefix instead of hard-deleting.
 */
export function createSupabaseStorageProvider(
  supabase: SupabaseClient<Database>,
): StorageProvider {
  async function upload(key: string, blob: Blob, metadata?: Record<string, string>): Promise<void> {
    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(key, blob, {
        upsert: true,
        metadata,
      });
    if (error) throw new Error(`Storage upload failed: ${error.message}`);
  }

  async function archive(key: string): Promise<void> {
    // Derive archive key: insert `_archive/` after the userId prefix
    // e.g. `abc123/reports/Q1.pdf` → `abc123/_archive/reports/Q1.pdf`
    const slashIdx = key.indexOf('/');
    if (slashIdx === -1) {
      throw new Error(`Invalid storage key format (no user prefix): ${key}`);
    }
    const userId = key.slice(0, slashIdx);
    const rest = key.slice(slashIdx + 1);
    const archiveKey = `${userId}/_archive/${rest}`;

    const { error } = await supabase.storage
      .from(BUCKET)
      .move(key, archiveKey);
    if (error) throw new Error(`Storage archive failed: ${error.message}`);
  }

  async function getSignedUrl(key: string, expirySeconds: number): Promise<string> {
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(key, expirySeconds);
    if (error) throw new Error(`Failed to create signed URL: ${error.message}`);
    return data.signedUrl;
  }

  async function list(prefix: string): Promise<StorageObject[]> {
    // Supabase list is non-recursive and page-limited.
    // We walk subdirectory prefixes recursively and paginate each level
    // with an offset loop so directories with > 1000 files are never truncated.
    const results: StorageObject[] = [];
    const PAGE_SIZE = 1000;

    async function walk(currentPrefix: string): Promise<void> {
      let offset = 0;

      while (true) {
        const { data, error } = await supabase.storage
          .from(BUCKET)
          .list(currentPrefix, { limit: PAGE_SIZE, offset });
        if (error) throw new Error(`Storage list failed: ${error.message}`);
        if (!data || data.length === 0) break;

        for (const item of data) {
          const fullKey = currentPrefix ? `${currentPrefix}/${item.name}` : item.name;
          if (item.id) {
            // It's a file
            results.push({
              key: fullKey,
              size: item.metadata?.size ?? 0,
              lastModified: item.updated_at ? new Date(item.updated_at) : null,
              metadata: item.metadata as Record<string, string> | undefined,
            });
          } else {
            // It's a "folder" prefix — recurse (not paginated at this level,
            // subdirectory entries are always < 1000 per realistic usage)
            await walk(fullKey);
          }
        }

        // If we got fewer items than the page size, we've reached the end
        if (data.length < PAGE_SIZE) break;
        offset += PAGE_SIZE;
      }
    }

    await walk(prefix);
    return results;
  }

  return { upload, archive, getSignedUrl, list };
}
