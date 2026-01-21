'use server'

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

// Create user with admin API (bypasses email verification)
export async function createUserAsAdmin(data: {
    email: string
    password: string
    name: string
    level: number
    reportsTo: string | null
}) {
    if (!supabaseServiceKey) {
        return {
            error: 'Server configuration error: SUPABASE_SERVICE_ROLE_KEY not set',
            user: null
        }
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
        auth: {
            autoRefreshToken: false,
            persistSession: false,
        },
    })

    try {
        // Create auth user with admin API
        const { data: authData, error: createError } = await supabase.auth.admin.createUser({
            email: data.email,
            password: data.password,
            email_confirm: true,
            user_metadata: {
                name: data.name,
                level: data.level,
                is_admin: false,
            },
        })

        if (createError) {
            return { error: createError.message, user: null }
        }

        // Update reports_to if provided
        if (authData.user && data.reportsTo) {
            const { error: updateError } = await supabase
                .from('users')
                .update({ reports_to: data.reportsTo })
                .eq('id', authData.user.id)

            if (updateError) {
                // Silently fail - user was created successfully, just reports_to wasn't set
            }
        }

        return { error: null, user: authData.user }
    } catch (err) {
        return {
            error: err instanceof Error ? err.message : 'Failed to create user',
            user: null
        }
    }
}

// Delete user completely (auth + profile)
export async function deleteUserAsAdmin(userId: string) {
    if (!supabaseServiceKey) {
        return { error: 'Server configuration error: SUPABASE_SERVICE_ROLE_KEY not set' }
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
        auth: {
            autoRefreshToken: false,
            persistSession: false,
        },
    })

    try {
        // Delete from auth (this also cascades to delete_user trigger in DB)
        const { error: authError } = await supabase.auth.admin.deleteUser(userId)

        if (authError) {
            return { error: authError.message }
        }

        // Also delete from users table in case there's no trigger
        await supabase.from('users').delete().eq('id', userId)

        return { error: null }
    } catch (err) {
        return {
            error: err instanceof Error ? err.message : 'Failed to delete user'
        }
    }
}
