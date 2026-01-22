-- Create storage bucket for message attachments
-- Run this in Supabase SQL Editor: https://supabase.com/dashboard/project/YOUR_PROJECT/sql

-- Create the bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'message-attachments',
  'message-attachments',
  false, -- Private bucket (requires authentication)
  10485760, -- 10MB limit
  ARRAY[
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain',
    'audio/webm',
    'audio/mpeg',
    'audio/mp4',
    'audio/ogg',
    'video/webm',
    'video/mp4'
  ]
)
ON CONFLICT (id) DO NOTHING;

-- RLS Policies for message-attachments bucket

-- Policy: Users can upload files to their own folder
CREATE POLICY "Users can upload to own folder"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'message-attachments' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy: Users can view files they uploaded
CREATE POLICY "Users can view own files"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'message-attachments' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy: Users can view files in conversations they're part of
-- (For viewing attachments sent by others in conversations)
CREATE POLICY "Users can view conversation files"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'message-attachments' AND
  EXISTS (
    SELECT 1 FROM messages m
    INNER JOIN conversation_members cm ON cm.conversation_id = m.conversation_id
    WHERE
      m.file_url LIKE '%' || name || '%' AND
      cm.user_id = auth.uid()
  )
);

-- Policy: Users can delete their own files
CREATE POLICY "Users can delete own files"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'message-attachments' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Enable RLS on storage.objects (if not already enabled)
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Verify bucket was created
SELECT * FROM storage.buckets WHERE id = 'message-attachments';
