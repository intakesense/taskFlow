-- ============================================================================
-- Work Folder Sync
-- Creates work_folder_configs, work_folder_files, storage bucket, and RLS.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- work_folder_configs — one row per user, tracks folder registration
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS work_folder_configs (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  folder_path         text NOT NULL,
  storage_prefix      text NOT NULL,
  configured_at       timestamptz NOT NULL DEFAULT now(),
  last_watcher_start  timestamptz,
  watcher_active      boolean NOT NULL DEFAULT false,
  CONSTRAINT work_folder_configs_user_id_key UNIQUE (user_id)
);

ALTER TABLE work_folder_configs ENABLE ROW LEVEL SECURITY;

-- Users: read/write their own row only
CREATE POLICY "work_folder_configs: users manage own row"
  ON work_folder_configs
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Admins: read all rows (no write)
CREATE POLICY "work_folder_configs: admins read all"
  ON work_folder_configs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users WHERE id = auth.uid() AND is_admin = true
    )
  );

-- ----------------------------------------------------------------------------
-- work_folder_files — one row per file, updated on every sync event
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS work_folder_files (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  file_name         text NOT NULL,
  relative_path     text NOT NULL,
  storage_key       text NOT NULL,
  file_size_bytes   bigint,
  checksum          text,
  status            text NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('synced', 'syncing', 'pending', 'failed', 'archived')),
  last_synced_at    timestamptz,
  last_modified_at  timestamptz,
  error_message     text,
  retry_count       integer NOT NULL DEFAULT 0,
  created_at        timestamptz NOT NULL DEFAULT now(),
  archived_at       timestamptz,
  CONSTRAINT work_folder_files_user_storage_key_key UNIQUE (user_id, storage_key)
);

CREATE INDEX IF NOT EXISTS idx_work_folder_files_user_id  ON work_folder_files (user_id);
CREATE INDEX IF NOT EXISTS idx_work_folder_files_status   ON work_folder_files (status);
CREATE INDEX IF NOT EXISTS idx_work_folder_files_user_status ON work_folder_files (user_id, status);

ALTER TABLE work_folder_files ENABLE ROW LEVEL SECURITY;

-- Users: read/write their own rows only
CREATE POLICY "work_folder_files: users manage own rows"
  ON work_folder_files
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Admins: read all rows (no write)
CREATE POLICY "work_folder_files: admins read all"
  ON work_folder_files
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users WHERE id = auth.uid() AND is_admin = true
    )
  );

-- ----------------------------------------------------------------------------
-- Supabase Storage — work-files bucket (private)
-- ----------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'work-files',
  'work-files',
  false,        -- private; all access via signed URLs
  524288000,    -- 500 MB per file (generous for office docs)
  null          -- all mime types allowed
)
ON CONFLICT (id) DO NOTHING;

-- Users: upload/read/delete only their own prefix ({userId}/...)
CREATE POLICY "work_files: users upload own files"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'work-files'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "work_files: users read own files"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'work-files'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Users can update (upsert) their own files
CREATE POLICY "work_files: users update own files"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'work-files'
    AND (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'work-files'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- No delete for regular users — archiving moves to _archive/ prefix instead
-- Admins: read all paths (for download and export)
CREATE POLICY "work_files: admins read all"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'work-files'
    AND EXISTS (
      SELECT 1 FROM users WHERE id = auth.uid() AND is_admin = true
    )
  );
