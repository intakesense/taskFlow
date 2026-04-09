import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@taskflow/core';
import { logError } from '../utils/error';

const BUCKET_NAME = 'message-attachments';
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export interface UploadedFile {
  path: string;
  url: string;
  size: number;
  type: string;
}

export interface FileUploadService {
  uploadFile: (file: File, userId: string) => Promise<UploadedFile>;
  getSignedUrl: (filePath: string) => Promise<string>;
  deleteFile: (filePath: string) => Promise<void>;
  uploadAudioBlob: (audioBlob: Blob, userId: string) => Promise<UploadedFile>;
}

export function createFileUploadService(
  getSupabase: () => SupabaseClient<Database>
): FileUploadService {
  /**
   * Upload a file to Supabase Storage
   * Files are organized by user ID: {userId}/{timestamp}-{filename}
   */
  async function uploadFile(file: File, userId: string): Promise<UploadedFile> {
    if (file.size > MAX_FILE_SIZE) {
      throw new Error(`File size must be less than ${MAX_FILE_SIZE / (1024 * 1024)}MB`);
    }

    const supabase = getSupabase();
    const timestamp = Date.now();
    const fileName = `${timestamp}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
    const filePath = `${userId}/${fileName}`;

    const { data, error } = await supabase.storage.from(BUCKET_NAME).upload(filePath, file, {
      cacheControl: '3600',
      upsert: false,
    });

    if (error) {
      logError('uploadFile', error);
      throw new Error(`Failed to upload file: ${error.message}`);
    }

    // Get public URL (even though bucket is private, we'll use signed URLs for access)
    const { data: urlData } = supabase.storage.from(BUCKET_NAME).getPublicUrl(data.path);

    return {
      path: data.path,
      url: urlData.publicUrl,
      size: file.size,
      type: file.type,
    };
  }

  /**
   * Get a signed URL for accessing a private file
   * URL expires after 1 hour
   */
  async function getSignedUrl(filePath: string): Promise<string> {
    const supabase = getSupabase();

    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .createSignedUrl(filePath, 3600); // 1 hour expiry

    if (error) {
      logError('getSignedUrl', error);
      throw new Error(`Failed to get signed URL: ${error.message}`);
    }

    return data.signedUrl;
  }

  /**
   * Delete a file from storage
   */
  async function deleteFile(filePath: string): Promise<void> {
    const supabase = getSupabase();

    const { error } = await supabase.storage.from(BUCKET_NAME).remove([filePath]);

    if (error) {
      logError('deleteFile', error);
      throw new Error(`Failed to delete file: ${error.message}`);
    }
  }

  /**
   * Upload an audio blob (voice message) to Supabase Storage
   * Automatically generates a filename with .webm extension
   */
  async function uploadAudioBlob(audioBlob: Blob, userId: string): Promise<UploadedFile> {
    // Convert Blob to File with proper name
    const timestamp = Date.now();
    const fileName = `voice-${timestamp}.webm`;
    const audioFile = new File([audioBlob], fileName, { type: audioBlob.type });

    return uploadFile(audioFile, userId);
  }

  return {
    uploadFile,
    getSignedUrl,
    deleteFile,
    uploadAudioBlob,
  };
}
