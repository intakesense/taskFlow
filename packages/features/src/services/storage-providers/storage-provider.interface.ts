/**
 * StorageProvider interface — wraps object storage backends.
 *
 * work-folder.ts calls only this interface; no component ever knows which
 * backend is running. Swap providers by changing STORAGE_PROVIDER env var.
 */

export interface StorageObject {
  key: string;
  size: number;
  lastModified: Date | null;
  metadata?: Record<string, string>;
}

export interface StorageProvider {
  /**
   * Upload a blob to the given storage key.
   * Always upsert — re-uploading an existing key is safe by design.
   */
  upload(key: string, blob: Blob, metadata?: Record<string, string>): Promise<void>;

  /**
   * Move a file to the `_archive/` prefix of its userId namespace.
   * Never hard-deletes bytes from storage.
   *
   * e.g. `abc123/reports/Q1.pdf` → `abc123/_archive/reports/Q1.pdf`
   */
  archive(key: string): Promise<void>;

  /**
   * Generate a time-limited signed URL for reading a private file.
   */
  getSignedUrl(key: string, expirySeconds: number): Promise<string>;

  /**
   * List all objects under a given prefix.
   */
  list(prefix: string): Promise<StorageObject[]>;
}
