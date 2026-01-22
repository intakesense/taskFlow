import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { TasksContainerSocial } from '@/components/tasks/tasks-container-social'
import { redirect } from 'next/navigation'

export default async function TasksPage() {
    // Server-side auth check
    const supabase = createClient(await cookies())

    // Validate user on server side
    const { data: { user }, error } = await supabase.auth.getUser()

    // Redirect to login if not authenticated
    if (error || !user) {
        redirect('/login')
    }

    // Return client component (it will fetch data via React Query)
    return <TasksContainerSocial />
}
