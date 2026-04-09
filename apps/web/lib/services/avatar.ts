import { createClient } from '@/lib/supabase/client'

const BUCKET_NAME = 'avatars'
const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']

export interface AvatarUploadResult {
  url: string
  path: string
}

/**
 * Upload a user avatar to Supabase Storage
 * Replaces any existing avatar for the user
 */
export async function uploadAvatar(
  file: File,
  userId: string
): Promise<AvatarUploadResult> {
  if (file.size > MAX_FILE_SIZE) {
    throw new Error(`File size must be less than ${MAX_FILE_SIZE / (1024 * 1024)}MB`)
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    throw new Error('File must be an image (JPEG, PNG, WebP, or GIF)')
  }

  const supabase = createClient()

  // Delete existing avatar first
  const { data: existingFiles } = await supabase.storage
    .from(BUCKET_NAME)
    .list(userId)

  if (existingFiles && existingFiles.length > 0) {
    const filesToDelete = existingFiles.map(f => `${userId}/${f.name}`)
    await supabase.storage.from(BUCKET_NAME).remove(filesToDelete)
  }

  // Generate unique filename
  const fileExt = file.name.split('.').pop()?.toLowerCase() || 'jpg'
  const fileName = `avatar-${Date.now()}.${fileExt}`
  const filePath = `${userId}/${fileName}`

  // Upload new avatar
  const { data, error } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(filePath, file, {
      cacheControl: '3600',
      upsert: true,
    })

  if (error) {
    throw new Error(`Failed to upload avatar: ${error.message}`)
  }

  // Get public URL
  const { data: urlData } = supabase.storage
    .from(BUCKET_NAME)
    .getPublicUrl(data.path)

  // Update user profile with avatar URL
  const { error: updateError } = await supabase
    .from('users')
    .update({ avatar_url: urlData.publicUrl })
    .eq('id', userId)

  if (updateError) {
    throw new Error(`Failed to update profile: ${updateError.message}`)
  }

  return {
    url: urlData.publicUrl,
    path: data.path,
  }
}

/**
 * Delete user's avatar
 */
export async function deleteAvatar(userId: string): Promise<void> {
  const supabase = createClient()

  // List and delete all files in user's avatar folder
  const { data: existingFiles } = await supabase.storage
    .from(BUCKET_NAME)
    .list(userId)

  if (existingFiles && existingFiles.length > 0) {
    const filesToDelete = existingFiles.map(f => `${userId}/${f.name}`)
    const { error: deleteError } = await supabase.storage
      .from(BUCKET_NAME)
      .remove(filesToDelete)

    if (deleteError) {
      throw new Error(`Failed to delete avatar: ${deleteError.message}`)
    }
  }

  // Clear avatar URL from user profile
  const { error: updateError } = await supabase
    .from('users')
    .update({ avatar_url: null })
    .eq('id', userId)

  if (updateError) {
    throw new Error(`Failed to update profile: ${updateError.message}`)
  }
}

/**
 * Get avatar URL for a user, returns null if no avatar
 */
export async function getAvatarUrl(userId: string): Promise<string | null> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('users')
    .select('avatar_url')
    .eq('id', userId)
    .single()

  if (error || !data) {
    return null
  }

  return data.avatar_url
}
