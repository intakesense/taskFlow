-- Make message-attachments bucket public
-- This allows public URLs to work while RLS policies still protect access

UPDATE storage.buckets
SET public = true
WHERE id = 'message-attachments';