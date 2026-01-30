import { createClient } from '@/lib/supabase/client'
import { Task, TaskWithUsers, TaskStatus, TaskPriority, Visibility, AssigneeWithDetails, UserBasic } from '@/lib/types'
import { logError } from '@/lib/utils/error'

function getSupabase() { return createClient() }

// Helper to fetch assignees for tasks from junction table
async function fetchAssigneesForTasks(taskIds: string[]): Promise<Map<string, AssigneeWithDetails[]>> {
    if (taskIds.length === 0) return new Map()

    const supabase = getSupabase()
    const { data, error } = await supabase
        .from('task_assignees')
        .select(`
            task_id,
            assigned_at,
            user:users!task_assignees_user_id_fkey(id, name, email, level, avatar_url)
        `)
        .in('task_id', taskIds)

    if (error) {
        logError('fetchAssigneesForTasks', error)
        throw error
    }

    const assigneesByTask = new Map<string, AssigneeWithDetails[]>()
    data?.forEach(item => {
        if (!assigneesByTask.has(item.task_id)) {
            assigneesByTask.set(item.task_id, [])
        }
        if (item.user) {
            const user = item.user as unknown as UserBasic
            assigneesByTask.get(item.task_id)!.push({
                ...user,
                assigned_at: item.assigned_at || new Date().toISOString()
            })
        }
    })

    return assigneesByTask
}

export async function getTasks(filters?: { status?: TaskStatus, assigneeId?: string, assignerId?: string }): Promise<TaskWithUsers[]> {
    const supabase = getSupabase()

    // If filtering by assignee, first get task IDs from junction table
    let taskIds: string[] | null = null
    if (filters?.assigneeId) {
        const { data: assignments, error: assignError } = await supabase
            .from('task_assignees')
            .select('task_id')
            .eq('user_id', filters.assigneeId)

        if (assignError) {
            logError('getTasks.assigneeFilter', assignError)
            throw assignError
        }
        taskIds = assignments?.map(a => a.task_id) || []

        if (taskIds.length === 0) {
            return []
        }
    }

    // Build main query
    let query = supabase.from('tasks').select(`
        *,
        assigner:users!tasks_assigned_by_fkey(id, name, email, level, avatar_url)
    `)

    if (filters?.status) query = query.eq('status', filters.status)
    if (filters?.assignerId) query = query.eq('assigned_by', filters.assignerId)
    if (taskIds !== null) query = query.in('id', taskIds)

    const { data: tasks, error } = await query.order('created_at', { ascending: false })
    if (error) {
        logError('getTasks.mainQuery', error)
        throw error
    }

    // Fetch assignees from junction table
    const allTaskIds = tasks?.map(t => t.id) || []
    const assigneesByTask = await fetchAssigneesForTasks(allTaskIds)

    // Combine data
    return (tasks || []).map(task => {
        const assignees = assigneesByTask.get(task.id) || []
        return {
            ...task,
            assigner: task.assigner as UserBasic | null,
            assignee: assignees[0] || null,
            assignees
        }
    }) as TaskWithUsers[]
}

export async function getTasksAssignedTo(userId: string): Promise<TaskWithUsers[]> {
    return getTasks({ assigneeId: userId })
}

export async function getTasksCreatedBy(userId: string): Promise<TaskWithUsers[]> {
    return getTasks({ assignerId: userId })
}

export async function getTaskById(taskId: string): Promise<TaskWithUsers | null> {
    const supabase = getSupabase()
    const { data, error } = await supabase.from('tasks').select(`
        *,
        assigner:users!tasks_assigned_by_fkey(id, name, email, level, avatar_url)
    `).eq('id', taskId).maybeSingle()

    if (error) {
        logError('getTaskById', error)
        throw error
    }

    if (!data) return null

    // Fetch assignees from junction table
    const assigneesByTask = await fetchAssigneesForTasks([taskId])
    const assignees = assigneesByTask.get(taskId) || []

    return {
        ...data,
        assigner: data.assigner as UserBasic | null,
        assignee: assignees[0] || null,
        assignees
    } as TaskWithUsers
}

export interface CreateTaskInput {
    title: string
    description?: string
    priority: TaskPriority
    status: TaskStatus
    deadline?: string
    assigned_to: string[]
    visibility: Visibility
}

export async function createTask(assignedBy: string, input: CreateTaskInput): Promise<Task> {
    const supabase = getSupabase()

    const { assigned_to: assigneeIds, ...taskInput } = input

    // Ensure description is always a string (not undefined)
    const taskData = {
        ...taskInput,
        description: taskInput.description || '',
        assigned_by: assignedBy
    }

    const { data: task, error } = await supabase.from('tasks').insert(taskData).select().single()

    if (error) {
        logError('createTask', error)
        throw error
    }

    // Add assignees to junction table
    if (assigneeIds.length > 0) {
        const assignees = assigneeIds.map(userId => ({
            task_id: task.id,
            user_id: userId
        }))

        const { error: assignError } = await supabase
            .from('task_assignees')
            .insert(assignees)

        if (assignError) {
            logError('createTask.assignees', assignError)
            await supabase.from('tasks').delete().eq('id', task.id)
            throw assignError
        }
    }

    return task as Task
}

export type UpdateTaskInput = Partial<Omit<CreateTaskInput, 'assigned_to'>> & {
    on_hold_reason?: string | null
    assigned_to?: string[]
}

export async function updateTask(taskId: string, updates: UpdateTaskInput): Promise<Task> {
    const supabase = getSupabase()

    const { assigned_to: assigneeIds, ...taskUpdates } = updates

    if (assigneeIds !== undefined) {
        await updateTaskAssignees(taskId, assigneeIds)
    }

    const { data, error } = await supabase.from('tasks').update(taskUpdates).eq('id', taskId).select().single()
    if (error) {
        logError('updateTask', error)
        throw error
    }
    return data as Task
}

export async function archiveTask(taskId: string): Promise<void> {
    const supabase = getSupabase()
    const { error } = await supabase.from('tasks').update({ status: 'archived' }).eq('id', taskId)
    if (error) {
        logError('archiveTask', error)
        throw error
    }
}

export async function deleteTask(taskId: string): Promise<void> {
    const supabase = getSupabase()
    const { error } = await supabase.from('tasks').delete().eq('id', taskId)
    if (error) {
        logError('deleteTask', error)
        throw error
    }
}

// Multi-assignee management functions

export async function updateTaskAssignees(taskId: string, userIds: string[]): Promise<void> {
    const supabase = getSupabase()

    const { error: deleteError } = await supabase
        .from('task_assignees')
        .delete()
        .eq('task_id', taskId)

    if (deleteError) {
        logError('updateTaskAssignees.delete', deleteError)
        throw deleteError
    }

    if (userIds.length > 0) {
        const { error: insertError } = await supabase
            .from('task_assignees')
            .insert(userIds.map(userId => ({
                task_id: taskId,
                user_id: userId
            })))

        if (insertError) {
            logError('updateTaskAssignees.insert', insertError)
            throw insertError
        }
    }
}

export async function addTaskAssignee(taskId: string, userId: string): Promise<void> {
    const supabase = getSupabase()
    const { error } = await supabase
        .from('task_assignees')
        .insert({ task_id: taskId, user_id: userId })

    if (error) {
        logError('addTaskAssignee', error)
        throw error
    }
}

export async function removeTaskAssignee(taskId: string, userId: string): Promise<void> {
    const supabase = getSupabase()
    const { error } = await supabase
        .from('task_assignees')
        .delete()
        .eq('task_id', taskId)
        .eq('user_id', userId)

    if (error) {
        logError('removeTaskAssignee', error)
        throw error
    }
}

export async function getTaskAssignees(taskId: string): Promise<AssigneeWithDetails[]> {
    const assigneesByTask = await fetchAssigneesForTasks([taskId])
    return assigneesByTask.get(taskId) || []
}
