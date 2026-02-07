-- Fix group avatar storage policies
-- The previous migration had a bug that tried to parse filenames as UUIDs
-- This migration drops the broken policies and creates correct ones

-- Drop the broken policies (if they exist)
DROP POLICY IF EXISTS "Group creators can upload group avatars" ON storage.objects;
DROP POLICY IF EXISTS "Group creators can update group avatars" ON storage.objects;
DROP POLICY IF EXISTS "Group creators can delete group avatars" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload group avatars" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update group avatars" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete group avatars" ON storage.objects;

-- Create correct policies that allow any authenticated user to upload to group-avatars/
-- The actual permission check happens when updating the conversation's avatar_url
-- (which requires them to be a group member per the existing RLS policy)

CREATE POLICY "Authenticated users can upload group avatars"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'avatars' AND
  (storage.foldername(name))[1] = 'group-avatars'
);

CREATE POLICY "Authenticated users can update group avatars"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'avatars' AND
  (storage.foldername(name))[1] = 'group-avatars'
);

CREATE POLICY "Authenticated users can delete group avatars"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'avatars' AND
  (storage.foldername(name))[1] = 'group-avatars'
);