import { createClient } from '@/lib/supabase/client'

const BUCKET_NAME = 'message-attachments'
const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB

export interface UploadedFile {
  path: string
  url: string
  size: number
  type: string
}

/**
 * Upload a file to Supabase Storage
 * Files are organized by user ID: {userId}/{timestamp}-{filename}
 */
export async function uploadFile(
  file: File,
  userId: string
): Promise<UploadedFile> {
  if (file.size > MAX_FILE_SIZE) {
    throw new Error(`File size must be less than ${MAX_FILE_SIZE / (1024 * 1024)}MB`)
  }

  const supabase = createClient()
  const timestamp = Date.now()
  const fileExt = file.name.split('.').pop()
  const fileName = `${timestamp}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`
  const filePath = `${userId}/${fileName}`

  const { data, error } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(filePath, file, {
      cacheControl: '3600',
      upsert: false,
    })

  if (error) {
    throw new Error(`Failed to upload file: ${error.message}`)
  }

  // Get public URL (even though bucket is private, we'll use signed URLs for access)
  const { data: urlData } = supabase.storage
    .from(BUCKET_NAME)
    .getPublicUrl(data.path)

  return {
    path: data.path,
    url: urlData.publicUrl,
    size: file.size,
    type: file.type,
  }
}

/**
 * Get a signed URL for accessing a private file
 * URL expires after 1 hour
 */
export async function getSignedUrl(filePath: string): Promise<string> {
  const supabase = createClient()

  const { data, error } = await supabase.storage
    .from(BUCKET_NAME)
    .createSignedUrl(filePath, 3600) // 1 hour expiry

  if (error) {
    throw new Error(`Failed to get signed URL: ${error.message}`)
  }

  return data.signedUrl
}

/**
 * Delete a file from storage
 */
export async function deleteFile(filePath: string): Promise<void> {
  const supabase = createClient()

  const { error } = await supabase.storage
    .from(BUCKET_NAME)
    .remove([filePath])

  if (error) {
    throw new Error(`Failed to delete file: ${error.message}`)
  }
}

/**
 * Get file metadata from storage
 */
export async function getFileMetadata(filePath: string) {
  const supabase = createClient()

  const { data, error } = await supabase.storage
    .from(BUCKET_NAME)
    .list(filePath.split('/')[0], {
      search: filePath.split('/')[1],
    })

  if (error) {
    throw new Error(`Failed to get file metadata: ${error.message}`)
  }

  return data[0]
}
