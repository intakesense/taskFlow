'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useServices } from '../providers/services-context';
import { useAuth } from '../providers/auth-context';
import { getErrorMessage } from '../utils/error';
import type { WorkFolderFileRow } from '../services/work-folder';

// ─── Query keys ───────────────────────────────────────────────────────────────

export const workFolderKeys = {
  all: ['work-folder'] as const,
  files: (userId: string) => [...workFolderKeys.all, 'files', userId] as const,
  config: (userId: string) => [...workFolderKeys.all, 'config', userId] as const,
  usage: (userId: string) => [...workFolderKeys.all, 'usage', userId] as const,
  // Admin: query for any user
  adminFiles: (userId: string) => [...workFolderKeys.all, 'admin', 'files', userId] as const,
  adminConfig: (userId: string) => [...workFolderKeys.all, 'admin', 'config', userId] as const,
};

// ─── Hooks ────────────────────────────────────────────────────────────────────

/** List all synced files for the current user. */
export function useWorkFolderFiles() {
  const { workFolder } = useServices();
  const { user } = useAuth();

  return useQuery({
    queryKey: workFolderKeys.files(user?.id ?? ''),
    queryFn: () => workFolder.listUserFiles(user!.id),
    enabled: !!user?.id,
    staleTime: 30_000,
  });
}

/** Get work folder config for the current user. */
export function useWorkFolderConfig() {
  const { workFolder } = useServices();
  const { user } = useAuth();

  return useQuery({
    queryKey: workFolderKeys.config(user?.id ?? ''),
    queryFn: () => workFolder.getConfig(user!.id),
    enabled: !!user?.id,
    staleTime: 60_000,
  });
}

/** Total bytes synced for the current user. */
export function useWorkFolderUsage() {
  const { workFolder } = useServices();
  const { user } = useAuth();

  return useQuery({
    queryKey: workFolderKeys.usage(user?.id ?? ''),
    queryFn: () => workFolder.getStorageUsage(user!.id),
    enabled: !!user?.id,
    staleTime: 60_000,
  });
}

/** Admin: list all files for a specific user. */
export function useAdminWorkFolderFiles(userId: string) {
  const { workFolder } = useServices();

  return useQuery({
    queryKey: workFolderKeys.adminFiles(userId),
    queryFn: () => workFolder.listUserFiles(userId),
    enabled: !!userId,
    staleTime: 30_000,
  });
}

/** Admin: get work folder config for a specific user. */
export function useAdminWorkFolderConfig(userId: string) {
  const { workFolder } = useServices();

  return useQuery({
    queryKey: workFolderKeys.adminConfig(userId),
    queryFn: () => workFolder.getConfig(userId),
    enabled: !!userId,
    staleTime: 60_000,
  });
}

/** Get a signed download URL for a file (admin use). */
export function useWorkFolderSignedUrl() {
  const { workFolder } = useServices();

  return useMutation({
    mutationFn: (storageKey: string) => workFolder.getSignedUrl(storageKey),
    onError: (error) => {
      toast.error(getErrorMessage(error, 'Failed to generate download link'));
    },
  });
}

/** Invalidate file list after a sync event (call from sync engine). */
export function useInvalidateWorkFolderFiles() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  return () => {
    if (user?.id) {
      queryClient.invalidateQueries({ queryKey: workFolderKeys.files(user.id) });
      queryClient.invalidateQueries({ queryKey: workFolderKeys.usage(user.id) });
    }
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

export function getStatusIcon(status: WorkFolderFileRow['status']): string {
  const icons: Record<string, string> = {
    synced: '✓',
    syncing: '↑',
    pending: '⏳',
    failed: '✗',
    archived: '🗄',
  };
  return icons[status] ?? '?';
}
