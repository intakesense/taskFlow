import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createTasksService } from '../../services/tasks'
import { createMockSupabase, makeTask } from '../helpers/mock-supabase'

describe('createTasksService', () => {
  let supabase: ReturnType<typeof createMockSupabase>['supabase']
  let builder: ReturnType<typeof createMockSupabase>['builder']
  let mockChain: ReturnType<typeof createMockSupabase>['mockChain']
  let service: ReturnType<typeof createTasksService>

  beforeEach(() => {
    const mock = createMockSupabase()
    supabase = mock.supabase
    builder = mock.builder
    mockChain = mock.mockChain
    service = createTasksService(supabase)
    vi.clearAllMocks()
  })

  // ─── normaliseTask ────────────────────────────────────────────────────────

  describe('normaliseTask (via getTasks)', () => {
    it('flattens task_assignees into assignees array', async () => {
      const raw = makeTask()
      mockChain.execute.mockResolvedValue({ data: [raw], error: null })

      const tasks = await service.getTasks()

      expect(tasks[0].assignees).toHaveLength(1)
      expect(tasks[0].assignees[0].id).toBe('user-assignee')
      expect(tasks[0].assignees[0].assigned_at).toBe('2026-01-01T00:00:00Z')
      // task_assignees removed from output
      expect((tasks[0] as unknown as Record<string, unknown>).task_assignees).toBeUndefined()
    })

    it('handles null users in task_assignees gracefully', async () => {
      const raw = makeTask({
        task_assignees: [{ assigned_at: null, user: null }],
      })
      mockChain.execute.mockResolvedValue({ data: [raw], error: null })

      const tasks = await service.getTasks()

      expect(tasks[0].assignees).toHaveLength(0)
    })

    it('handles empty task_assignees array', async () => {
      const raw = makeTask({ task_assignees: [] })
      mockChain.execute.mockResolvedValue({ data: [raw], error: null })

      const tasks = await service.getTasks()

      expect(tasks[0].assignees).toHaveLength(0)
    })
  })

  // ─── getTasks ─────────────────────────────────────────────────────────────

  describe('getTasks', () => {
    it('returns empty array when no tasks exist', async () => {
      mockChain.execute.mockResolvedValue({ data: [], error: null })

      const tasks = await service.getTasks()

      expect(tasks).toEqual([])
    })

    it('applies status filter', async () => {
      mockChain.execute.mockResolvedValue({ data: [], error: null })

      await service.getTasks({ status: 'in_progress' })

      expect(builder.eq).toHaveBeenCalledWith('status', 'in_progress')
    })

    it('applies assignerId filter', async () => {
      mockChain.execute.mockResolvedValue({ data: [], error: null })

      await service.getTasks({ assignerId: 'user-creator' })

      expect(builder.eq).toHaveBeenCalledWith('assigned_by', 'user-creator')
    })

    it('returns empty array early when assigneeId has no task_assignees', async () => {
      // First query: task_assignees lookup returns empty
      mockChain.execute.mockResolvedValueOnce({ data: [], error: null })

      const tasks = await service.getTasks({ assigneeId: 'user-nobody' })

      expect(tasks).toEqual([])
      // Should NOT call from('tasks') for the main query
      expect(supabase.from).toHaveBeenCalledTimes(1)
      expect(supabase.from).toHaveBeenCalledWith('task_assignees')
    })

    it('throws when supabase returns an error', async () => {
      mockChain.execute.mockResolvedValue({ data: null, error: { message: 'DB error' } })

      await expect(service.getTasks()).rejects.toMatchObject({ message: 'DB error' })
    })
  })

  // ─── getTasksPaginated ────────────────────────────────────────────────────

  describe('getTasksPaginated', () => {
    it('returns hasMore=false when results <= limit', async () => {
      const tasks = [makeTask({ id: 'task-1' }), makeTask({ id: 'task-2' })]
      mockChain.execute.mockResolvedValue({ data: tasks, error: null })

      const result = await service.getTasksPaginated({ limit: 25 })

      expect(result.hasMore).toBe(false)
      expect(result.nextCursor).toBeNull()
      expect(result.data).toHaveLength(2)
    })

    it('returns hasMore=true and nextCursor when results > limit', async () => {
      // limit=2, return 3 rows → hasMore=true, cursor = last of first 2
      const tasks = [
        makeTask({ id: 'task-1', created_at: '2026-03-01T00:00:00Z' }),
        makeTask({ id: 'task-2', created_at: '2026-02-01T00:00:00Z' }),
        makeTask({ id: 'task-3', created_at: '2026-01-01T00:00:00Z' }),
      ]
      mockChain.execute.mockResolvedValue({ data: tasks, error: null })

      const result = await service.getTasksPaginated({ limit: 2 })

      expect(result.hasMore).toBe(true)
      expect(result.nextCursor).toBe('2026-02-01T00:00:00Z')
      expect(result.data).toHaveLength(2)
    })

    it('applies cursor filter with lt operator', async () => {
      mockChain.execute.mockResolvedValue({ data: [], error: null })

      await service.getTasksPaginated({ cursor: '2026-01-15T00:00:00Z', limit: 10 })

      expect(builder.lt).toHaveBeenCalledWith('created_at', '2026-01-15T00:00:00Z')
    })

    it('returns empty result early when assigneeId has no assignments', async () => {
      mockChain.execute.mockResolvedValueOnce({ data: [], error: null })

      const result = await service.getTasksPaginated({ assigneeId: 'user-nobody' })

      expect(result).toEqual({ data: [], nextCursor: null, hasMore: false })
    })
  })

  // ─── getTaskById ──────────────────────────────────────────────────────────

  describe('getTaskById', () => {
    it('returns normalised task when found', async () => {
      mockChain.maybeSingle.mockResolvedValue({ data: makeTask(), error: null })

      const task = await service.getTaskById('task-1')

      expect(task).not.toBeNull()
      expect(task?.id).toBe('task-1')
      expect(task?.assignees).toHaveLength(1)
    })

    it('returns null when task not found', async () => {
      mockChain.maybeSingle.mockResolvedValue({ data: null, error: null })

      const task = await service.getTaskById('missing')

      expect(task).toBeNull()
    })

    it('throws on supabase error', async () => {
      mockChain.maybeSingle.mockResolvedValue({ data: null, error: { message: 'not found' } })

      await expect(service.getTaskById('task-1')).rejects.toMatchObject({ message: 'not found' })
    })
  })

  // ─── createTask ───────────────────────────────────────────────────────────

  describe('createTask', () => {
    it('inserts task then inserts assignees', async () => {
      const createdTask = { id: 'task-new', title: 'New task' }
      mockChain.single.mockResolvedValueOnce({ data: createdTask, error: null })
      // Assignees insert (terminal via then)
      mockChain.execute.mockResolvedValue({ data: null, error: null })

      const result = await service.createTask('user-creator', {
        title: 'New task',
        priority: 'medium',
        status: 'pending',
        visibility: 'hierarchy_same',
        assigned_to: ['user-assignee'],
      })

      expect(result.id).toBe('task-new')
      expect(supabase.from).toHaveBeenCalledWith('tasks')
      expect(supabase.from).toHaveBeenCalledWith('task_assignees')
    })

    it('rolls back task insert when assignees insert fails', async () => {
      const createdTask = { id: 'task-rollback' }
      mockChain.single.mockResolvedValueOnce({ data: createdTask, error: null })
      mockChain.execute.mockResolvedValue({ data: null, error: { message: 'FK violation' } })

      await expect(
        service.createTask('user-creator', {
          title: 'Task',
          priority: 'low',
          status: 'pending',
          visibility: 'private',
          assigned_to: ['bad-user'],
        })
      ).rejects.toMatchObject({ message: 'FK violation' })

      // Verify delete was called on rollback
      expect(supabase.from).toHaveBeenCalledWith('tasks')
      expect(builder.delete).toHaveBeenCalled()
      expect(builder.eq).toHaveBeenCalledWith('id', 'task-rollback')
    })

    it('skips assignees insert when assigned_to is empty', async () => {
      mockChain.single.mockResolvedValue({ data: { id: 'task-solo' }, error: null })

      await service.createTask('user-creator', {
        title: 'Solo task',
        priority: 'high',
        status: 'pending',
        visibility: 'private',
        assigned_to: [],
      })

      // task_assignees should never be touched
      expect(supabase.from).not.toHaveBeenCalledWith('task_assignees')
    })
  })

  // ─── changeStatus ─────────────────────────────────────────────────────────

  describe('changeStatus', () => {
    it('clears on_hold_reason when transitioning away from on_hold', async () => {
      mockChain.single.mockResolvedValue({ data: makeTask({ status: 'in_progress' }), error: null })

      await service.changeStatus('task-1', 'in_progress')

      expect(builder.update).toHaveBeenCalledWith(
        expect.objectContaining({ on_hold_reason: null })
      )
    })

    it('sets on_hold_reason when transitioning to on_hold', async () => {
      mockChain.single.mockResolvedValue({ data: makeTask({ status: 'on_hold' }), error: null })

      await service.changeStatus('task-1', 'on_hold', { onHoldReason: 'Blocked by dependency' })

      expect(builder.update).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'on_hold',
          on_hold_reason: 'Blocked by dependency',
        })
      )
    })

    it('throws when supabase update fails', async () => {
      mockChain.single.mockResolvedValue({ data: null, error: { message: 'Only assignees can start a task' } })

      await expect(service.changeStatus('task-1', 'in_progress')).rejects.toMatchObject({
        message: 'Only assignees can start a task',
      })
    })
  })

  // ─── updateTaskAssignees ──────────────────────────────────────────────────

  describe('updateTaskAssignees', () => {
    it('deletes existing then inserts new assignees', async () => {
      mockChain.execute.mockResolvedValue({ data: null, error: null })

      await service.updateTaskAssignees('task-1', ['user-a', 'user-b'])

      expect(builder.delete).toHaveBeenCalled()
      expect(builder.eq).toHaveBeenCalledWith('task_id', 'task-1')
      expect(builder.insert).toHaveBeenCalledWith([
        { task_id: 'task-1', user_id: 'user-a' },
        { task_id: 'task-1', user_id: 'user-b' },
      ])
    })

    it('skips insert when new assignees list is empty', async () => {
      mockChain.execute.mockResolvedValue({ data: null, error: null })

      await service.updateTaskAssignees('task-1', [])

      expect(builder.delete).toHaveBeenCalled()
      // insert called once for delete chain, not for assignees
      const insertCalls = vi.mocked(builder.insert as ReturnType<typeof vi.fn>).mock.calls
      expect(insertCalls).toHaveLength(0)
    })

    it('throws when delete fails', async () => {
      mockChain.execute.mockResolvedValueOnce({ data: null, error: { message: 'delete failed' } })

      await expect(service.updateTaskAssignees('task-1', [])).rejects.toMatchObject({
        message: 'delete failed',
      })
    })
  })
})
