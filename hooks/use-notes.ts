// useNotes - React Query hooks that wrap task notes service
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
    getTaskNotes,
    addNote,
    updateNoteVisibility,
    deleteNote,
    getVisibilityLabel,
    getVisibilityIcon,
    CreateNoteInput
} from '@/lib/services/notes';
import { Visibility } from '@/lib/types';

// Query keys
export const noteKeys = {
    all: ['task-notes'] as const,
    task: (taskId: string) => [...noteKeys.all, taskId] as const,
};

// Re-export utility functions
export { getVisibilityLabel, getVisibilityIcon };

// Hooks
export function useNotes(taskId: string | undefined) {
    return useQuery({
        queryKey: noteKeys.task(taskId || ''),
        queryFn: () => getTaskNotes(taskId!),
        enabled: !!taskId,
        staleTime: 30000,
    });
}

export function useCreateNote() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ userId, input }: { userId: string; input: CreateNoteInput }) =>
            addNote(userId, input),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: noteKeys.task(variables.input.task_id) });
        },
    });
}

export function useUpdateNote() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ noteId, visibility }: { noteId: string; visibility: Visibility }) =>
            updateNoteVisibility(noteId, visibility),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: noteKeys.all });
        },
    });
}

export function useDeleteNote() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: deleteNote,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: noteKeys.all });
        },
    });
}
