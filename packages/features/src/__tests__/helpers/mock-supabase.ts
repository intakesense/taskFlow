import { vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@taskflow/core'

/**
 * Builds a chainable Supabase query mock.
 *
 * Usage:
 *   const { supabase, mockChain } = createMockSupabase()
 *   mockChain.single.mockResolvedValue({ data: task, error: null })
 */
export function createMockSupabase() {
  // The terminal methods that actually resolve
  const mockChain = {
    single: vi.fn(),
    maybeSingle: vi.fn(),
    // Default: resolves with empty array
    execute: vi.fn().mockResolvedValue({ data: [], error: null }),
  }

  // A builder that always returns itself so chaining works,
  // and delegates terminal calls to mockChain
  function makeBuilder(overrides: Record<string, unknown> = {}): Record<string, unknown> {
    const builder: Record<string, unknown> = {
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      upsert: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      neq: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      lt: vi.fn().mockReturnThis(),
      gt: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      lte: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      range: vi.fn().mockReturnThis(),
      filter: vi.fn().mockReturnThis(),
      match: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(),
      // Terminal methods delegate to mockChain so tests can control the response
      single: mockChain.single,
      maybeSingle: mockChain.maybeSingle,
      then: (resolve: (value: unknown) => unknown) =>
        mockChain.execute().then(resolve),
      ...overrides,
    }
    return builder
  }

  const builder = makeBuilder()

  const supabase = {
    from: vi.fn().mockReturnValue(builder),
    auth: {
      getUser: vi.fn(),
      getSession: vi.fn(),
      onAuthStateChange: vi.fn().mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } }),
    },
    channel: vi.fn().mockReturnValue({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn().mockReturnThis(),
    }),
    removeChannel: vi.fn(),
    storage: {
      from: vi.fn().mockReturnValue({
        upload: vi.fn(),
        remove: vi.fn(),
        getPublicUrl: vi.fn().mockReturnValue({ data: { publicUrl: 'https://example.com/avatar.png' } }),
      }),
    },
  } as unknown as SupabaseClient<Database>

  return { supabase, builder, mockChain }
}

/** Shorthand: resolved Supabase response */
export const ok = <T>(data: T) => Promise.resolve({ data, error: null })

/** Shorthand: rejected Supabase response */
export const fail = (message: string) =>
  Promise.resolve({ data: null, error: { message, code: 'ERROR', details: '', hint: '' } })

/** Minimal TaskWithUsers factory */
export function makeTask(overrides: Partial<Record<string, unknown>> = {}): Record<string, unknown> {
  return {
    id: 'task-1',
    title: 'Test task',
    description: '',
    status: 'pending',
    priority: 'medium',
    visibility: 'hierarchy_same',
    assigned_by: 'user-creator',
    deadline: null,
    on_hold_reason: null,
    completed_at: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    assigner: { id: 'user-creator', name: 'Creator', email: 'creator@test.com', level: 2, avatar_url: null },
    task_assignees: [
      {
        assigned_at: '2026-01-01T00:00:00Z',
        user: { id: 'user-assignee', name: 'Assignee', email: 'assignee@test.com', level: 3, avatar_url: null },
      },
    ],
    ...overrides,
  }
}
