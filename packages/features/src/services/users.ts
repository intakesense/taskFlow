import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, User } from '@taskflow/core';

/**
 * Creates a users service bound to a Supabase client.
 */
export function createUsersService(supabase: SupabaseClient<Database>) {
  return {
    /**
     * Get all users ordered by level and name.
     */
    async getUsers(): Promise<User[]> {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .order('level', { ascending: true })
        .order('name', { ascending: true });

      if (error) throw error;
      return data as User[];
    },

    /**
     * Get a single user by ID.
     */
    async getUserById(userId: string): Promise<User | null> {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (error) throw error;
      return data as User | null;
    },

    /**
     * Get users that can be assigned tasks by the current user.
     * Users at the same level or below can be assigned.
     */
    async getAssignableUsers(currentUserLevel: number): Promise<User[]> {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .gte('level', currentUserLevel)
        .order('level', { ascending: true })
        .order('name', { ascending: true });

      if (error) throw error;
      return data as User[];
    },

    /**
     * Update a user's profile.
     */
    async updateUser(userId: string, updates: Partial<Omit<User, 'id' | 'created_at'>>): Promise<User> {
      const { data, error } = await supabase
        .from('users')
        .update(updates)
        .eq('id', userId)
        .select()
        .single();

      if (error) throw error;
      return data as User;
    },

    /**
     * Delete a user (admin only).
     */
    async deleteUser(userId: string): Promise<void> {
      const { error } = await supabase
        .from('users')
        .delete()
        .eq('id', userId);

      if (error) throw error;
    },
  };
}

export type UsersService = ReturnType<typeof createUsersService>;

// Utility functions (pure, no Supabase dependency)

const LEVEL_NAMES: Record<number, string> = {
  1: 'Director',
  2: 'Manager',
  3: 'Team Lead',
  4: 'Senior',
  5: 'Junior',
};

/**
 * Get display label for user level.
 */
export function getLevelLabel(level: number): string {
  return LEVEL_NAMES[level] ?? `L${level}`;
}

/**
 * Get Tailwind class for level badge color.
 */
export function getLevelColor(level: number): string {
  const colors: Record<number, string> = {
    1: 'bg-purple-500',
    2: 'bg-blue-500',
    3: 'bg-green-500',
    4: 'bg-yellow-500',
    5: 'bg-orange-500'
  };
  return colors[level] || 'bg-gray-500';
}
