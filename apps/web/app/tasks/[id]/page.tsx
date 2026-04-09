import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { TaskDetailContainerSocial } from '@/components/tasks/task-detail-container-social'
import { redirect } from 'next/navigation'

export default async function TaskDetailPage({ params }: { params: Promise<{ id: string }> }) {
  // Server-side auth check
  const supabase = createClient(await cookies())

  // Validate user on server side
  const { data: { user }, error } = await supabase.auth.getUser()

  // Redirect to login if not authenticated
  if (error || !user) {
    redirect('/login')
  }

  // Await params as per Next.js 15+ requirement
  const { id: taskId } = await params

  return <TaskDetailContainerSocial taskId={taskId} />
}
