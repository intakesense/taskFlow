'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { DriveFile } from '../components/messages/drive-picker';
import { useConfig } from '../providers/config-context';

interface RawAttachment {
    file_id: string
    file_name: string
    mime_type: string
    web_view_link: string
    icon_link?: string | null
}

async function fetchDriveAttachments(taskId: string, apiBaseUrl: string): Promise<DriveFile[]> {
    const res = await fetch(`${apiBaseUrl}/api/google/drive?taskId=${taskId}`)
    if (!res.ok) {
        // NO_TOKEN = user hasn't connected Google — return empty, not an error
        if (res.status === 403) return []
        throw new Error('Failed to fetch drive attachments')
    }
    const { attachments } = await res.json()
    return (attachments as RawAttachment[]).map(a => ({
        id: a.file_id,
        name: a.file_name,
        mimeType: a.mime_type,
        url: a.web_view_link,
        iconUrl: a.icon_link ?? undefined,
    }))
}

export const driveAttachmentKeys = {
    task: (taskId: string) => ['drive-attachments', 'task', taskId] as const,
}

export function useDriveAttachments(taskId: string) {
    const { apiBaseUrl } = useConfig()
    return useQuery({
        queryKey: driveAttachmentKeys.task(taskId),
        queryFn: () => fetchDriveAttachments(taskId, apiBaseUrl),
        staleTime: 30_000, // 30s — Drive attachments don't change frequently
    })
}

/** Returns a function to invalidate the drive attachments cache for a task. */
export function useInvalidateDriveAttachments() {
    const queryClient = useQueryClient()
    return (taskId: string) =>
        queryClient.invalidateQueries({ queryKey: driveAttachmentKeys.task(taskId) })
}
