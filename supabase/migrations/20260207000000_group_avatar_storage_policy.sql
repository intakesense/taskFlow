-- Add storage policy for group avatars
-- Any group member can upload avatars to the group-avatars/ folder
-- The conversation update RLS already validates membership

-- Policy: Authenticated users can upload to group-avatars folder
-- Storage upload happens before the conversation update, so we allow any authenticated user
-- The actual permission check happens when they try to update the conversation's avatar_url
-- (which requires them to be a group member per the existing RLS policy)
CREATE POLICY "Authenticated users can upload group avatars"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'avatars' AND
  (storage.foldername(name))[1] = 'group-avatars'
);

-- Policy: Authenticated users can update files in group-avatars (for upsert)
CREATE POLICY "Authenticated users can update group avatars"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'avatars' AND
  (storage.foldername(name))[1] = 'group-avatars'
);

-- Policy: Authenticated users can delete group avatars
CREATE POLICY "Authenticated users can delete group avatars"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'avatars' AND
  (storage.foldername(name))[1] = 'group-avatars'
);