import { createClient } from '@/lib/supabase/client'
import { Task, TaskWithUsers, TaskStatus, TaskPriority, Visibility } from '@/lib/types'

function getSupabase() { return createClient() }

export async function getTasks(filters?: { status?: TaskStatus, assigneeId?: string, assignerId?: string }): Promise<TaskWithUsers[]> {
    const supabase = getSupabase()
    let query = supabase.from('tasks').select(`
        *,
        assignee:users!tasks_assigned_to_fkey(*),
        assigner:users!tasks_assigned_by_fkey(*)
    `)

    if (filters?.status) query = query.eq('status', filters.status)
    if (filters?.assigneeId) query = query.eq('assigned_to', filters.assigneeId)
    if (filters?.assignerId) query = query.eq('assigned_by', filters.assignerId)

    const { data, error } = await query.order('created_at', { ascending: false })
    if (error) throw error
    return data as TaskWithUsers[]
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
        assignee:users!tasks_assigned_to_fkey(*),
        assigner:users!tasks_assigned_by_fkey(*)
    `).eq('id', taskId).maybeSingle()

    if (error) {
        throw new Error(`Failed to fetch task: ${error.message}`)
    }
    return data as TaskWithUsers | null
}

export interface CreateTaskInput {
    title: string
    description?: string
    priority: TaskPriority
    status: TaskStatus
    deadline?: string
    assigned_to: string
    visibility: Visibility
}

export async function createTask(assignedBy: string, input: CreateTaskInput): Promise<Task> {
    const supabase = getSupabase()
    const { data, error } = await supabase.from('tasks').insert({
        ...input,
        assigned_by: assignedBy
    }).select().single()

    if (error) throw error
    return data as Task
}

export type UpdateTaskInput = Partial<CreateTaskInput> & { on_hold_reason?: string | null }

export async function updateTask(taskId: string, updates: UpdateTaskInput): Promise<Task> {
    const supabase = getSupabase()
    const { data, error } = await supabase.from('tasks').update(updates).eq('id', taskId).select().single()
    if (error) throw error
    return data as Task
}

export async function archiveTask(taskId: string): Promise<void> {
    const supabase = getSupabase()
    const { error } = await supabase.from('tasks').update({ status: 'archived' }).eq('id', taskId)
    if (error) throw error
}

export async function deleteTask(taskId: string): Promise<void> {
    const supabase = getSupabase()
    const { error } = await supabase.from('tasks').delete().eq('id', taskId)
    if (error) throw error
}
