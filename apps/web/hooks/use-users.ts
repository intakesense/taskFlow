// useUsers - React Query hooks that wrap user service functions
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
    getUsers,
    getUserById,
    getAssignableUsers,
    updateUser,
    deleteUser,
    getLevelLabel,
    getLevelColor
} from '@/lib/services/users';
import { User } from '@/lib/types';

// Query keys
export const userKeys = {
    all: ['users'] as const,
    lists: () => [...userKeys.all, 'list'] as const,
    assignable: (level: number) => [...userKeys.all, 'assignable', level] as const,
    details: () => [...userKeys.all, 'detail'] as const,
    detail: (id: string) => [...userKeys.details(), id] as const,
};

// Re-export utility functions from service
export { getLevelLabel, getLevelColor };

// Hooks
export function useUsers() {
    return useQuery({
        queryKey: userKeys.lists(),
        queryFn: () => getUsers(),
        staleTime: 30000, // 30 seconds
    });
}

export function useAssignableUsers(currentLevel: number | undefined) {
    return useQuery({
        queryKey: userKeys.assignable(currentLevel || 0),
        queryFn: () => getAssignableUsers(currentLevel!),
        enabled: currentLevel !== undefined,
        staleTime: 30000,
    });
}

export function useUser(id: string) {
    return useQuery({
        queryKey: userKeys.detail(id),
        queryFn: () => getUserById(id),
        enabled: !!id,
    });
}

export function useUpdateUser() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ id, updates }: { id: string; updates: Partial<User> }) =>
            updateUser(id, updates),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: userKeys.all });
        },
    });
}

export function useDeleteUser() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: deleteUser,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: userKeys.all });
        },
    });
}
