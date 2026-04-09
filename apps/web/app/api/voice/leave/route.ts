import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

// CORS headers for desktop app
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Credentials': 'true',
}

// Handle preflight requests
export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders })
}

// GET handler - for regular leave requests
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const channelId = searchParams.get('channelId')
  const userId = searchParams.get('userId')

  if (!channelId || !userId) {
    return new Response('Missing parameters', { status: 400, headers: corsHeaders })
  }

  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)

  await supabase
    .from('voice_channel_participants')
    .delete()
    .eq('channel_id', channelId)
    .eq('user_id', userId)

  return new Response('OK', { headers: corsHeaders })
}

// POST handler - for Beacon API (page unload cleanup)
// Uses admin client since session may be ending
export async function POST(request: NextRequest) {
  try {
    const { userId } = await request.json()

    if (!userId) {
      return NextResponse.json({ error: 'User ID required' }, { status: 400, headers: corsHeaders })
    }

    // Use admin client to bypass RLS since user session may be ending
    const supabase = createAdminClient()

    // Delete all participant records for this user
    await supabase
      .from('voice_channel_participants')
      .delete()
      .eq('user_id', userId)

    // End any open sessions
    await supabase
      .from('voice_channel_sessions')
      .update({ left_at: new Date().toISOString() })
      .eq('user_id', userId)
      .is('left_at', null)

    return NextResponse.json({ success: true }, { headers: corsHeaders })
  } catch (error) {
    console.error('Voice leave error:', error)
    return NextResponse.json({ error: 'Failed to leave' }, { status: 500, headers: corsHeaders })
  }
}
