import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'

const AI_BOT_USER_ID = '00000000-0000-0000-0000-000000000001'

/**
 * Activate the AI bot in a voice channel.
 * Called when a user clicks "Activate Bot" in the UI.
 *
 * The calling user becomes the "host" - their browser will run the AI
 * and play responses into Daily.co for all participants to hear.
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

    const { channelId } = await request.json()

    if (!channelId) {
      return NextResponse.json({ error: 'Channel ID required' }, { status: 400 })
    }

    // Check if bot is enabled by admin
    const { data: botConfig } = await supabase
      .from('ai_bot_config')
      .select('is_enabled, name, voice')
      .single()

    if (!botConfig?.is_enabled) {
      return NextResponse.json(
        { error: 'AI Bot is disabled by administrator' },
        { status: 400 }
      )
    }

    // Check if bot is already active in this channel
    const { data: existingSession } = await supabase
      .from('ai_sessions')
      .select('id, host_user_id, status')
      .eq('voice_channel_id', channelId)
      .eq('status', 'active')
      .single()

    if (existingSession) {
      // Bot already active - get host info
      let hostName = 'Another user'
      if (existingSession.host_user_id) {
        const { data: hostUser } = await supabase
          .from('users')
          .select('name')
          .eq('id', existingSession.host_user_id)
          .single()
        hostName = hostUser?.name || 'Another user'
      }

      return NextResponse.json({
        error: 'Bot is already active',
        alreadyActive: true,
        hostUserId: existingSession.host_user_id,
        hostName,
        sessionId: existingSession.id,
      }, { status: 409 })
    }

    // Get OpenAI ephemeral token for the host's browser
    const tokenResponse = await fetch('https://api.openai.com/v1/realtime/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: process.env.OPENAI_REALTIME_MODEL,
        voice: botConfig.voice || 'alloy',
      }),
    })

    if (!tokenResponse.ok) {
      const error = await tokenResponse.text()
      console.error('OpenAI token error:', error)
      return NextResponse.json(
        { error: 'Failed to get AI session token' },
        { status: 500 }
      )
    }

    const tokenData = await tokenResponse.json()

    // Add bot to participants table (so it appears in the UI)
    await supabase.from('voice_channel_participants').upsert({
      channel_id: channelId,
      user_id: AI_BOT_USER_ID,
      is_muted: false, // Bot will speak
      is_video_on: false,
    }, {
      onConflict: 'channel_id,user_id',
    })

    // Create AI session record with host tracking
    const { data: session, error: sessionError } = await supabase
      .from('ai_sessions')
      .insert({
        voice_channel_id: channelId,
        host_user_id: user.id,
        status: 'active',
      })
      .select('id')
      .single()

    if (sessionError) {
      console.error('Session creation error:', sessionError)
      return NextResponse.json(
        { error: 'Failed to create bot session' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: `${botConfig.name} activated`,
      sessionId: session.id,
      botName: botConfig.name,
      clientSecret: tokenData.client_secret,
      expiresAt: tokenData.expires_at,
      model: process.env.OPENAI_REALTIME_MODEL,
    })
  } catch (error) {
    console.error('Bot join error:', error)
    return NextResponse.json(
      { error: 'Failed to activate bot' },
      { status: 500 }
    )
  }
}

/**
 * Check if bot is active and who's hosting it.
 */
export async function GET(request: NextRequest) {
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

    const channelId = request.nextUrl.searchParams.get('channelId')

    if (!channelId) {
      return NextResponse.json({ error: 'Channel ID required' }, { status: 400 })
    }

    // Get active session for this channel
    const { data: session } = await supabase
      .from('ai_sessions')
      .select(`
        id,
        host_user_id,
        status,
        started_at
      `)
      .eq('voice_channel_id', channelId)
      .eq('status', 'active')
      .single()

    if (!session) {
      return NextResponse.json({
        isActive: false,
      })
    }

    // Get host info
    let hostName = 'Unknown'
    if (session.host_user_id) {
      const { data: hostUser } = await supabase
        .from('users')
        .select('id, name, avatar_url')
        .eq('id', session.host_user_id)
        .single()
      hostName = hostUser?.name || 'Unknown'
    }

    return NextResponse.json({
      isActive: true,
      sessionId: session.id,
      hostUserId: session.host_user_id,
      hostName,
      isCurrentUserHost: session.host_user_id === user.id,
      startedAt: session.started_at,
    })
  } catch (error) {
    console.error('Bot status error:', error)
    return NextResponse.json(
      { error: 'Failed to get bot status' },
      { status: 500 }
    )
  }
}