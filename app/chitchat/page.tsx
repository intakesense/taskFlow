import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { ChitChatContainer } from '@/components/voice/chitchat-container'

export const metadata = {
  title: 'ChitChat',
}

export default async function ChitChatPage() {
  const supabase = createClient(await cookies())

  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) {
    redirect('/login')
  }

  return <ChitChatContainer />
}
