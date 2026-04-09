'use client';

import { useQuery } from '@tanstack/react-query';
import { useServices } from '../providers/services-context';
import type {} from '@taskflow/core';

// Query keys factory
export const userKeys = {
  all: ['users'] as const,
  lists: () => [...userKeys.all, 'list'] as const,
  assignable: (level?: number) => [...userKeys.all, 'assignable', level] as const,
  detail: (id: string) => [...userKeys.all, 'detail', id] as const,
};

/**
 * Hook to fetch all users.
 */
export function useUsers() {
  const { users } = useServices();

  return useQuery({
    queryKey: userKeys.lists(),
    queryFn: () => users.getUsers(),
  });
}

/**
 * Hook to fetch users that can be assigned by the current user.
 */
export function useAssignableUsers(currentUserLevel: number | undefined) {
  const { users } = useServices();

  return useQuery({
    queryKey: userKeys.assignable(currentUserLevel),
    queryFn: () => users.getAssignableUsers(currentUserLevel!),
    enabled: currentUserLevel !== undefined,
  });
}

/**
 * Hook to fetch a single user by ID.
 */
export function useUser(userId: string | null) {
  const { users } = useServices();

  return useQuery({
    queryKey: userKeys.detail(userId || ''),
    queryFn: () => users.getUserById(userId!),
    enabled: !!userId,
  });
}
