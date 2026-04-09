'use client';

import { createContext, useContext, useMemo, type ReactNode } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@taskflow/core';
import { createTasksService, type TasksService } from '../services/tasks';
import { createMessagesService, type MessagesService } from '../services/messages';
import { createUsersService, type UsersService } from '../services/users';
import { createProgressService, type ProgressService } from '../services/progress';
import { createTaskMessagesService, type TaskMessagesService } from '../services/task-messages';
import { createTaskNotesService, type TaskNotesService } from '../services/task-notes';
import { createFileUploadService, type FileUploadService } from '../services/file-upload';

export interface ServicesContextValue {
  tasks: TasksService;
  messages: MessagesService;
  users: UsersService;
  progress: ProgressService;
  taskMessages: TaskMessagesService;
  taskNotes: TaskNotesService;
  fileUpload: FileUploadService;
  supabase: SupabaseClient<Database>;
}

const ServicesContext = createContext<ServicesContextValue | null>(null);

export interface ServicesProviderProps {
  children: ReactNode;
  supabase: SupabaseClient<Database>;
}

/**
 * Provides data services to feature components.
 * Services are created once and memoized based on the Supabase client.
 *
 * @example
 * ```tsx
 * // In your app root
 * import { createBrowserClient } from '@supabase/ssr';
 *
 * const supabase = createBrowserClient(url, key);
 *
 * <ServicesProvider supabase={supabase}>
 *   <App />
 * </ServicesProvider>
 * ```
 */
export function ServicesProvider({ children, supabase }: ServicesProviderProps) {
  const services = useMemo(
    () => ({
      tasks: createTasksService(supabase),
      messages: createMessagesService(supabase),
      users: createUsersService(supabase),
      progress: createProgressService(() => supabase),
      taskMessages: createTaskMessagesService(() => supabase),
      taskNotes: createTaskNotesService(() => supabase),
      fileUpload: createFileUploadService(() => supabase),
      supabase,
    }),
    [supabase]
  );

  return (
    <ServicesContext.Provider value={services}>
      {children}
    </ServicesContext.Provider>
  );
}

/**
 * Hook to access data services.
 *
 * @example
 * ```tsx
 * const { tasks, messages, users } = useServices();
 *
 * // Use in React Query
 * const { data } = useQuery({
 *   queryKey: ['tasks'],
 *   queryFn: () => tasks.getTasks(),
 * });
 * ```
 */
export function useServices(): ServicesContextValue {
  const context = useContext(ServicesContext);
  if (!context) {
    throw new Error('useServices must be used within a ServicesProvider');
  }
  return context;
}

/**
 * Direct access to the Supabase client.
 * Prefer using services for data operations.
 */
export function useSupabase(): SupabaseClient<Database> {
  const { supabase } = useServices();
  return supabase;
}
