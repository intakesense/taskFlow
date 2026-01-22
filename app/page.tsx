import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { MessagesContainer } from '@/components/messages/messages-container'
import { redirect } from 'next/navigation'

export default async function MessagesPage() {
  // Server-side auth check and data fetch
  const supabase = createClient(await cookies())

  // Validate user on server side
  const { data: { user }, error } = await supabase.auth.getUser()

  // Redirect to login if not authenticated
  if (error || !user) {
    redirect('/login')
  }

  // Return client component (it will fetch data via React Query with Realtime)
  return <MessagesContainer />
}
