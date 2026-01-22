-- Storage Policies for message-attachments bucket
-- Allows users to upload/view/delete files in their own folder

-- Policy 1: Users can upload files to their own folder
CREATE POLICY "Users can upload to own folder"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'message-attachments' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy 2: Users can view their own files
CREATE POLICY "Users can view own files"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'message-attachments' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy 3: Users can view files in conversations they're part of
-- (Allows viewing voice messages/attachments sent by others in your conversations)
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

-- Policy 4: Users can delete their own files
CREATE POLICY "Users can delete own files"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'message-attachments' AND
  (storage.foldername(name))[1] = auth.uid()::text
);
