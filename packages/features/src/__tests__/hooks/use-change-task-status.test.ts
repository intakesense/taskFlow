import { describe, it, expect, vi } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useChangeTaskStatus, taskKeys } from '../../hooks/use-tasks'
import { makeWrapper } from '../helpers/render-with-providers'
import type { TaskWithUsers } from '@taskflow/core'

/** Minimal TaskWithUsers for cache seeding */
function seedTask(overrides: Partial<TaskWithUsers> = {}): TaskWithUsers {
  return {
    id: 'task-1',
    title: 'Test task',
    description: '',
    status: 'pending',
    priority: 'medium',
    visibility: 'hierarchy_same',
    assigned_by: 'creator-id',
    deadline: null,
    on_hold_reason: null,
    completed_at: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    assigner: { id: 'creator-id', name: 'Creator', email: 'c@test.com', level: 2, avatar_url: null },
    assignees: [{ id: 'assignee-id', name: 'Assignee', email: 'a@test.com', level: 3, avatar_url: null, assigned_at: '2026-01-01T00:00:00Z' }],
    ...overrides,
  } as unknown as TaskWithUsers
}

/**
 * Each test is fully isolated: its own queryClient, Wrapper, and service mocks.
 * No shared mutable state between tests.
 */
function setup(task: TaskWithUsers, changeStatusImpl: () => Promise<unknown>) {
  const changeStatus = vi.fn().mockImplementation(changeStatusImpl)
  const { Wrapper, queryClient } = makeWrapper({
    initialTasks: [task],
    services: {
      tasks: {
        changeStatus,
        getTasks: vi.fn().mockResolvedValue([task]),
      } as unknown as ReturnType<typeof makeWrapper>['services']['tasks'],
    },
  })
  const { result } = renderHook(() => useChangeTaskStatus(), { wrapper: Wrapper })
  return { result, queryClient, changeStatus }
}

describe('useChangeTaskStatus', () => {
  // ─── optimistic update ────────────────────────────────────────────────────

  it('optimistically updates status in the cache before the mutation resolves', async () => {
    const task = seedTask({ status: 'pending' })
    const { result, queryClient } = setup(
      task,
      // Delayed response so we can inspect the in-flight optimistic state
      () => new Promise((resolve) => setTimeout(() => resolve(seedTask({ status: 'in_progress' })), 50))
    )

    act(() => {
      result.current.mutate({ taskId: 'task-1', status: 'in_progress' })
    })

    await waitFor(() => {
      const cached = queryClient.getQueryData<TaskWithUsers[]>(taskKeys.lists())
      expect(cached?.[0].status).toBe('in_progress')
    })
  })

  it('confirms the optimistic update after server success', async () => {
    const task = seedTask({ status: 'pending' })
    const { result } = setup(task, () => Promise.resolve(seedTask({ status: 'in_progress' })))

    await act(async () => {
      await result.current.mutateAsync({ taskId: 'task-1', status: 'in_progress' })
    })

    // React Query flushes mutation state asynchronously after mutateAsync resolves
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
  })

  // ─── rollback on error ────────────────────────────────────────────────────

  it('rolls back the optimistic update when the mutation fails', async () => {
    const task = seedTask({ status: 'pending' })
    const { result, queryClient } = setup(
      task,
      () => Promise.reject(new Error('Only assignees can start a task'))
    )

    await act(async () => {
      await result.current.mutateAsync({ taskId: 'task-1', status: 'in_progress' }).catch(() => {})
    })

    const cached = queryClient.getQueryData<TaskWithUsers[]>(taskKeys.lists())
    expect(cached?.[0].status).toBe('pending')
  })

  it('shows a user-friendly toast on status transition error', async () => {
    const { toast } = await import('sonner')
    vi.mocked(toast.error).mockClear()

    const task = seedTask({ status: 'pending' })
    const { result } = setup(
      task,
      () => Promise.reject(new Error('Only assignees can start a task'))
    )

    await act(async () => {
      await result.current.mutateAsync({ taskId: 'task-1', status: 'in_progress' }).catch(() => {})
    })

    expect(toast.error).toHaveBeenCalledWith('You must be assigned to this task to start it')
  })

  // ─── error message mapping ─────────────────────────────────────────────────

  it.each([
    ['Only assignees can start', 'You must be assigned to this task to start it'],
    ['Only assignees can put',   'You must be assigned to this task to pause it'],
    ['on_hold_reason is required', 'Please provide a reason for pausing this task'],
    ['Only assignees can resume', 'You must be assigned to this task to resume it'],
    ['Invalid status transition', 'This status change is not allowed'],
    ['some unknown error',        'Failed to change task status'],
  ])('maps DB error "%s" → toast "%s"', async (dbError, expectedToast) => {
    const { toast } = await import('sonner')
    vi.mocked(toast.error).mockClear()

    const task = seedTask()
    const { result } = setup(task, () => Promise.reject(new Error(dbError)))

    await act(async () => {
      await result.current.mutateAsync({ taskId: 'task-1', status: 'in_progress' }).catch(() => {})
    })

    expect(toast.error).toHaveBeenCalledWith(expectedToast)
  })

  // ─── edge cases ───────────────────────────────────────────────────────────

  it('does not crash when transitioning to completed with no assigner', async () => {
    const task = seedTask({ assigner: null })
    const { result } = setup(task, () => Promise.resolve(seedTask({ status: 'completed' })))

    await act(async () => {
      await result.current.mutateAsync({ taskId: 'task-1', status: 'completed' })
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
  })
})
