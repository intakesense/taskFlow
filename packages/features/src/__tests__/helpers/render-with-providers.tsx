import React from 'react'
import { render, type RenderOptions } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, TaskWithUsers } from '@taskflow/core'
import { ServicesContext, type ServicesContextValue } from '../../providers/services-context'
import { ConfigProvider } from '../../providers/config-context'
import { createMockSupabase } from './mock-supabase'
import { taskKeys } from '../../hooks/use-tasks'

export function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      // retry: false — never retry in tests; instant failure surfacing
      // gcTime: Infinity — keep seeded cache data alive for the test's duration.
      //   A fresh client is created per test, so isolation comes from the client
      //   boundary, not from garbage collection.
      queries: { retry: false, gcTime: Infinity },
      mutations: { retry: false },
    },
  })
}

interface WrapperOptions {
  supabase?: SupabaseClient<Database>
  services?: Partial<ServicesContextValue>
  queryClient?: QueryClient
  /** Pre-seed the task list cache under taskKeys.lists() */
  initialTasks?: TaskWithUsers[]
}

export function makeWrapper(options: WrapperOptions = {}) {
  const { supabase: mockSupabase } = createMockSupabase()
  const supabase = options.supabase ?? mockSupabase
  const queryClient = options.queryClient ?? makeQueryClient()

  const defaultServices: ServicesContextValue = {
    supabase,
    tasks: {
      getTasks: vi.fn().mockResolvedValue([]),
      getTasksPaginated: vi.fn().mockResolvedValue({ data: [], nextCursor: null, hasMore: false }),
      getTaskById: vi.fn().mockResolvedValue(null),
      createTask: vi.fn(),
      updateTask: vi.fn(),
      changeStatus: vi.fn(),
      archiveTask: vi.fn(),
      deleteTask: vi.fn(),
      updateTaskAssignees: vi.fn(),
      addTaskAssignee: vi.fn(),
      removeTaskAssignee: vi.fn(),
      getTaskAssignees: vi.fn().mockResolvedValue([]),
      getTaskAuditLog: vi.fn().mockResolvedValue([]),
    },
    messages: {} as ServicesContextValue['messages'],
    users: {} as ServicesContextValue['users'],
    progress: {} as ServicesContextValue['progress'],
    taskMessages: {} as ServicesContextValue['taskMessages'],
    taskNotes: {} as ServicesContextValue['taskNotes'],
    fileUpload: {} as ServicesContextValue['fileUpload'],
    ...options.services,
  }

  function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <ConfigProvider config={{ apiBaseUrl: '', googleApiKey: '', logoSrc: '' }}>
          <ServicesContext.Provider value={defaultServices}>
            {children}
          </ServicesContext.Provider>
        </ConfigProvider>
      </QueryClientProvider>
    )
  }

  // Seed task list cache after the client is created.
  // Uses taskKeys.lists() — the exact key useChangeTaskStatus reads/writes
  // for optimistic updates — so cache inspections in tests use the same key.
  if (options.initialTasks) {
    queryClient.setQueryData(taskKeys.lists(), options.initialTasks)
  }

  return { Wrapper, queryClient, services: defaultServices, supabase }
}

export function renderWithProviders(
  ui: React.ReactElement,
  options: WrapperOptions & Omit<RenderOptions, 'wrapper'> = {}
) {
  const { Wrapper, queryClient, services, supabase } = makeWrapper(options)
  return {
    ...render(ui, { wrapper: Wrapper, ...options }),
    queryClient,
    services,
    supabase,
  }
}
