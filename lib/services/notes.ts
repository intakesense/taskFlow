import { createClient } from '@/lib/supabase/client'
import { TaskNote, TaskNoteWithAuthor, Visibility } from '@/lib/types'

function getSupabase() { return createClient() }

export async function getTaskNotes(taskId: string): Promise<TaskNoteWithAuthor[]> {
    const supabase = getSupabase()
    const { data, error } = await supabase
        .from('task_notes')
        .select(`
            *,
            author:users!task_notes_added_by_fkey(id, name, email, level)
        `)
        .eq('task_id', taskId)
        .order('created_at', { ascending: false })

    if (error) throw error
    return data as TaskNoteWithAuthor[]
}

export interface CreateNoteInput {
    task_id: string
    content: string
    visibility: Visibility
}

export async function addNote(userId: string, input: CreateNoteInput): Promise<TaskNote> {
    const supabase = getSupabase()
    const { data, error } = await supabase
        .from('task_notes')
        .insert({
            task_id: input.task_id,
            content: input.content,
            visibility: input.visibility,
            added_by: userId
        })
        .select()
        .single()

    if (error) throw error
    return data as TaskNote
}

export async function updateNoteVisibility(noteId: string, visibility: Visibility): Promise<TaskNote> {
    const supabase = getSupabase()
    const { data, error } = await supabase
        .from('task_notes')
        .update({ visibility })
        .eq('id', noteId)
        .select()
        .single()

    if (error) throw error
    return data as TaskNote
}

export async function deleteNote(noteId: string): Promise<void> {
    const supabase = getSupabase()
    const { error } = await supabase.from('task_notes').delete().eq('id', noteId)
    if (error) throw error
}

export function getVisibilityLabel(visibility: Visibility): string {
    const labels: Record<Visibility, string> = {
        private: 'Private (Assignee only)',
        supervisor: 'Supervisor (L2+)',
        hierarchy_same: 'Same Level & Above',
        hierarchy_above: 'Above Level Only',
        all: 'Everyone'
    }
    return labels[visibility] || visibility
}

export function getVisibilityIcon(visibility: Visibility): string {
    const icons: Record<Visibility, string> = {
        private: 'Lock',
        supervisor: 'User',
        hierarchy_same: 'Users',
        hierarchy_above: 'ChevronUp',
        all: 'Globe'
    }
    return icons[visibility] || 'Eye'
}
