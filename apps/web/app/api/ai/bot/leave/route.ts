import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'

const AI_BOT_USER_ID = '00000000-0000-0000-0000-000000000001'

/**
 * Deactivate the AI bot from a voice channel.
 * Can be called by:
 * 1. The host clicking "Deactivate Bot"
 * 2. When the host leaves the channel
 * 3. When no humans remain in the channel
 */
export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const supabase = createClient(cookieStore)

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { channelId, force } = await request.json()

    if (!channelId) {
      return NextResponse.json({ error: 'Channel ID required' }, { status: 400 })
    }

    // Get active session
    const { data: session } = await supabase
      .from('ai_sessions')
      .select('id, host_user_id, transcript')
      .eq('voice_channel_id', channelId)
      .eq('status', 'active')
      .single()

    if (!session) {
      return NextResponse.json({
        success: true,
        message: 'Bot was not active',
      })
    }

    // Check if user has permission to deactivate
    // Either they are the host, or they're forcing (admin) or no humans remain
    const isHost = session.host_user_id === user.id

    if (!isHost && !force) {
      // Check if user is admin
      const { data: userProfile } = await supabase
        .from('users')
        .select('is_admin')
        .eq('id', user.id)
        .single()

      if (!userProfile?.is_admin) {
        return NextResponse.json({
          error: 'Only the host or an admin can deactivate the bot',
          hostUserId: session.host_user_id,
        }, { status: 403 })
      }
    }

    // End the session
    await supabase
      .from('ai_sessions')
      .update({
        status: 'ended',
        ended_at: new Date().toISOString(),
      })
      .eq('id', session.id)

    // Remove bot from participants
    await supabase
      .from('voice_channel_participants')
      .delete()
      .eq('channel_id', channelId)
      .eq('user_id', AI_BOT_USER_ID)

    // Get bot config for name
    const { data: botConfig } = await supabase
      .from('ai_bot_config')
      .select('name')
      .single()

    return NextResponse.json({
      success: true,
      message: `${botConfig?.name || 'Bot'} deactivated`,
      sessionId: session.id,
    })
  } catch (error) {
    console.error('Bot leave error:', error)
    return NextResponse.json(
      { error: 'Failed to deactivate bot' },
      { status: 500 }
    )
  }
}
