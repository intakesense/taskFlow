import { createClient } from '@/lib/supabase/client'
import { User } from '@/lib/types'

function getSupabase() { return createClient() }

export async function getUsers(): Promise<User[]> {
    const supabase = getSupabase()
    const { data, error } = await supabase.from('users').select('*').order('level', { ascending: true }).order('name', { ascending: true })
    if (error) throw error
    return data as User[]
}

export async function getUserById(userId: string): Promise<User | null> {
    const supabase = getSupabase()
    const { data, error } = await supabase.from('users').select('*').eq('id', userId).maybeSingle()
    if (error) {
        throw new Error(`Failed to fetch user: ${error.message}`)
    }
    return data as User | null
}

export async function getAssignableUsers(currentUserLevel: number): Promise<User[]> {
    const supabase = getSupabase()
    const { data, error } = await supabase.from('users').select('*').gte('level', currentUserLevel).order('level', { ascending: true }).order('name', { ascending: true })
    if (error) throw error
    return data as User[]
}

export async function updateUser(userId: string, updates: Partial<Omit<User, 'id' | 'created_at'>>): Promise<User> {
    const supabase = getSupabase()
    const { data, error } = await supabase.from('users').update(updates).eq('id', userId).select().single()
    if (error) throw error
    return data as User
}

export async function deleteUser(userId: string): Promise<void> {
    const supabase = getSupabase()
    const { error } = await supabase.from('users').delete().eq('id', userId)
    if (error) throw error
}

export function getLevelLabel(level: number): string {
    return `L${level}`
}

export function getLevelColor(level: number): string {
    const colors: Record<number, string> = {
        1: 'bg-purple-500',
        2: 'bg-blue-500',
        3: 'bg-green-500',
        4: 'bg-yellow-500',
        5: 'bg-orange-500'
    }
    return colors[level] || 'bg-gray-500'
}
