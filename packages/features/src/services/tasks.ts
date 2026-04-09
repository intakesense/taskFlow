import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  Database,
  Task,
  TaskWithUsers,
  TaskStatus,
  TaskPriority,
  Visibility,
  AssigneeWithDetails,
  UserBasic,
  TaskAuditLogWithUser,
} from '@taskflow/core';

export interface TaskFilters {
  status?: TaskStatus;
  assigneeId?: string;
  assignerId?: string;
  cursor?: string;  // ISO timestamp for cursor-based pagination
  limit?: number;   // Default 25
}

export interface PaginatedTasksResult {
  data: TaskWithUsers[];
  nextCursor: string | null;
  hasMore: boolean;
  total?: number;
}

export interface CreateTaskInput {
  title: string;
  description?: string;
  priority: TaskPriority;
  status: TaskStatus;
  deadline?: string;
  assigned_to: string[];
  visibility: Visibility;
}

export type UpdateTaskInput = Partial<Omit<CreateTaskInput, 'assigned_to'>> & {
  on_hold_reason?: string | null;
  assigned_to?: string[];
};

/**
 * Creates a tasks service bound to a Supabase client.
 */
export function createTasksService(supabase: SupabaseClient<Database>) {
  // Helper to fetch assignees for tasks from junction table
  async function fetchAssigneesForTasks(taskIds: string[]): Promise<Map<string, AssigneeWithDetails[]>> {
    if (taskIds.length === 0) return new Map();

    const { data, error } = await supabase
      .from('task_assignees')
      .select(`
        task_id,
        assigned_at,
        user:users!task_assignees_user_id_fkey(id, name, email, level, avatar_url)
      `)
      .in('task_id', taskIds);

    if (error) throw error;

    const assigneesByTask = new Map<string, AssigneeWithDetails[]>();
    data?.forEach(item => {
      if (!assigneesByTask.has(item.task_id)) {
        assigneesByTask.set(item.task_id, []);
      }
      if (item.user) {
        const user = item.user as unknown as UserBasic;
        assigneesByTask.get(item.task_id)!.push({
          ...user,
          assigned_at: item.assigned_at || new Date().toISOString()
        });
      }
    });

    return assigneesByTask;
  }

  return {
    /**
     * Get all tasks with optional filters.
     * Note: For large datasets, use getTasksPaginated instead.
     */
    async getTasks(filters?: TaskFilters): Promise<TaskWithUsers[]> {
      // If filtering by assignee, first get task IDs from junction table
      let taskIds: string[] | null = null;
      if (filters?.assigneeId) {
        const { data: assignments, error: assignError } = await supabase
          .from('task_assignees')
          .select('task_id')
          .eq('user_id', filters.assigneeId);

        if (assignError) throw assignError;
        taskIds = assignments?.map(a => a.task_id) || [];

        if (taskIds.length === 0) return [];
      }

      // Build main query
      let query = supabase.from('tasks').select(`
        *,
        assigner:users!tasks_assigned_by_fkey(id, name, email, level, avatar_url)
      `);

      if (filters?.status) query = query.eq('status', filters.status);
      if (filters?.assignerId) query = query.eq('assigned_by', filters.assignerId);
      if (taskIds !== null) query = query.in('id', taskIds);

      const { data: tasks, error } = await query.order('created_at', { ascending: false });
      if (error) throw error;

      // Fetch assignees from junction table
      const allTaskIds = tasks?.map(t => t.id) || [];
      const assigneesByTask = await fetchAssigneesForTasks(allTaskIds);

      // Combine data
      return (tasks || []).map(task => {
        const assignees = assigneesByTask.get(task.id) || [];
        return {
          ...task,
          assigner: task.assigner as UserBasic | null,
          assignees
        };
      }) as TaskWithUsers[];
    },

    /**
     * Get tasks with cursor-based pagination for better performance at scale.
     */
    async getTasksPaginated(filters?: TaskFilters): Promise<PaginatedTasksResult> {
      const limit = filters?.limit || 25;

      // If filtering by assignee, first get task IDs from junction table
      let taskIds: string[] | null = null;
      if (filters?.assigneeId) {
        const { data: assignments, error: assignError } = await supabase
          .from('task_assignees')
          .select('task_id')
          .eq('user_id', filters.assigneeId);

        if (assignError) throw assignError;
        taskIds = assignments?.map(a => a.task_id) || [];

        if (taskIds.length === 0) {
          return { data: [], nextCursor: null, hasMore: false };
        }
      }

      // Build main query
      let query = supabase.from('tasks').select(`
        *,
        assigner:users!tasks_assigned_by_fkey(id, name, email, level, avatar_url)
      `);

      if (filters?.status) query = query.eq('status', filters.status);
      if (filters?.assignerId) query = query.eq('assigned_by', filters.assignerId);
      if (taskIds !== null) query = query.in('id', taskIds);

      // Cursor-based pagination: fetch tasks older than cursor
      if (filters?.cursor) {
        query = query.lt('created_at', filters.cursor);
      }

      // Fetch one extra to determine if there are more
      const { data: tasks, error } = await query
        .order('created_at', { ascending: false })
        .limit(limit + 1);

      if (error) throw error;

      const hasMore = (tasks?.length || 0) > limit;
      const actualTasks = hasMore ? tasks!.slice(0, limit) : (tasks || []);

      // Fetch assignees from junction table
      const allTaskIds = actualTasks.map(t => t.id);
      const assigneesByTask = await fetchAssigneesForTasks(allTaskIds);

      // Combine data
      const tasksWithUsers = actualTasks.map(task => {
        const assignees = assigneesByTask.get(task.id) || [];
        return {
          ...task,
          assigner: task.assigner as UserBasic | null,
          assignees
        };
      }) as TaskWithUsers[];

      // Next cursor is the created_at of the last item
      const nextCursor = hasMore && actualTasks.length > 0
        ? actualTasks[actualTasks.length - 1].created_at
        : null;

      return {
        data: tasksWithUsers,
        nextCursor,
        hasMore,
      };
    },

    /**
     * Get a single task by ID.
     */
    async getTaskById(taskId: string): Promise<TaskWithUsers | null> {
      const { data, error } = await supabase.from('tasks').select(`
        *,
        assigner:users!tasks_assigned_by_fkey(id, name, email, level, avatar_url)
      `).eq('id', taskId).maybeSingle();

      if (error) throw error;
      if (!data) return null;

      const assigneesByTask = await fetchAssigneesForTasks([taskId]);
      const assignees = assigneesByTask.get(taskId) || [];

      return {
        ...data,
        assigner: data.assigner as UserBasic | null,
        assignees
      } as TaskWithUsers;
    },

    /**
     * Create a new task.
     */
    async createTask(assignedBy: string, input: CreateTaskInput): Promise<Task> {
      const { assigned_to: assigneeIds, ...taskInput } = input;

      const taskData = {
        ...taskInput,
        description: taskInput.description || '',
        assigned_by: assignedBy
      };

      const { data: task, error } = await supabase.from('tasks').insert(taskData).select().single();
      if (error) throw error;

      // Add assignees to junction table
      if (assigneeIds.length > 0) {
        const assignees = assigneeIds.map(userId => ({
          task_id: task.id,
          user_id: userId
        }));

        const { error: assignError } = await supabase
          .from('task_assignees')
          .insert(assignees);

        if (assignError) {
          await supabase.from('tasks').delete().eq('id', task.id);
          throw assignError;
        }
      }

      return task as Task;
    },

    /**
     * Update an existing task.
     */
    async updateTask(taskId: string, updates: UpdateTaskInput): Promise<Task> {
      const { assigned_to: assigneeIds, ...taskUpdates } = updates;

      if (assigneeIds !== undefined) {
        await this.updateTaskAssignees(taskId, assigneeIds);
      }

      const { data, error } = await supabase.from('tasks').update(taskUpdates).eq('id', taskId).select().single();
      if (error) throw error;
      return data as Task;
    },

    /**
     * Change task status with optional reason (for on_hold).
     * This is the preferred method for status changes as it handles
     * the on_hold_reason requirement automatically.
     */
    async changeStatus(
      taskId: string,
      newStatus: TaskStatus,
      options?: { onHoldReason?: string }
    ): Promise<Task> {
      const updates: UpdateTaskInput = { status: newStatus };
      if (newStatus === 'on_hold' && options?.onHoldReason) {
        updates.on_hold_reason = options.onHoldReason;
      }
      // Clear on_hold_reason when resuming (not on_hold anymore)
      if (newStatus !== 'on_hold') {
        updates.on_hold_reason = null;
      }
      return this.updateTask(taskId, updates);
    },

    /**
     * Archive a task (soft delete).
     */
    async archiveTask(taskId: string): Promise<void> {
      const { error } = await supabase.from('tasks').update({ status: 'archived' }).eq('id', taskId);
      if (error) throw error;
    },

    /**
     * Delete a task permanently.
     */
    async deleteTask(taskId: string): Promise<void> {
      const { error } = await supabase.from('tasks').delete().eq('id', taskId);
      if (error) throw error;
    },

    /**
     * Update task assignees (replace all).
     */
    async updateTaskAssignees(taskId: string, userIds: string[]): Promise<void> {
      const { error: deleteError } = await supabase
        .from('task_assignees')
        .delete()
        .eq('task_id', taskId);

      if (deleteError) throw deleteError;

      if (userIds.length > 0) {
        const { error: insertError } = await supabase
          .from('task_assignees')
          .insert(userIds.map(userId => ({
            task_id: taskId,
            user_id: userId
          })));

        if (insertError) throw insertError;
      }
    },

    /**
     * Add a single assignee to a task.
     */
    async addTaskAssignee(taskId: string, userId: string): Promise<void> {
      const { error } = await supabase
        .from('task_assignees')
        .insert({ task_id: taskId, user_id: userId });

      if (error) throw error;
    },

    /**
     * Remove a single assignee from a task.
     */
    async removeTaskAssignee(taskId: string, userId: string): Promise<void> {
      const { error } = await supabase
        .from('task_assignees')
        .delete()
        .eq('task_id', taskId)
        .eq('user_id', userId);

      if (error) throw error;
    },

    /**
     * Get all assignees for a task.
     */
    async getTaskAssignees(taskId: string): Promise<AssigneeWithDetails[]> {
      const assigneesByTask = await fetchAssigneesForTasks([taskId]);
      return assigneesByTask.get(taskId) || [];
    },

    /**
     * Get audit log for a task (who changed what, when).
     */
    async getTaskAuditLog(taskId: string, limit = 50): Promise<TaskAuditLogWithUser[]> {
      const { data, error } = await supabase
        .from('task_audit_log')
        .select(`
          *,
          user:users!task_audit_log_user_id_fkey(id, name, email, level, avatar_url)
        `)
        .eq('task_id', taskId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;

      return (data || []).map(item => ({
        ...item,
        user: item.user as UserBasic | null,
      })) as TaskAuditLogWithUser[];
    },
  };
}

export type TasksService = ReturnType<typeof createTasksService>;
