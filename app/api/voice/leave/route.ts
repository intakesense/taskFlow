import { createClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'
import { NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const channelId = searchParams.get('channelId')
  const userId = searchParams.get('userId')

  if (!channelId || !userId) {
    return new Response('Missing parameters', { status: 400 })
  }

  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)

  await supabase
    .from('voice_channel_participants')
    .delete()
    .eq('channel_id', channelId)
    .eq('user_id', userId)

  return new Response('OK')
}
