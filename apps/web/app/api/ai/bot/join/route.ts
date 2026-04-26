import { NextRequest, NextResponse } from 'next/server'
import { createClientFromRequest } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

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
    const { supabase, user, error } = await createClientFromRequest(request)
    if (error) return NextResponse.json({ error }, { status: 401 })

    const { channelId } = await request.json()
    if (!channelId) {
      return NextResponse.json({ error: 'Channel ID required' }, { status: 400 })
    }

    const { data: botConfig } = await supabase
      .from('ai_bot_config')
      .select('is_enabled, name, voice, trigger_phrases')
      .single()

    if (!botConfig?.is_enabled) {
      return NextResponse.json({ error: 'AI Bot is disabled by administrator' }, { status: 400 })
    }

    const { data: existingSession } = await supabase
      .from('ai_sessions')
      .select('id, host_user_id, status')
      .eq('voice_channel_id', channelId)
      .eq('status', 'active')
      .single()

    if (existingSession) {
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

    const model = process.env.OPENAI_REALTIME_MODEL
    const voice = botConfig.voice || 'alloy'

    // Get OpenAI ephemeral client key for the host's browser.
    // Must use /v1/realtime/client_secrets — this endpoint returns a top-level
    // "value" string (prefix "ek_") for use with session.connect({ apiKey }).
    const tokenResponse = await fetch('https://api.openai.com/v1/realtime/client_secrets', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ session: { type: 'realtime', model } }),
    })

    if (!tokenResponse.ok) {
      const err = await tokenResponse.text()
      console.error('OpenAI token error:', err)
      return NextResponse.json({ error: 'Failed to get AI session token' }, { status: 500 })
    }

    const tokenData = await tokenResponse.json()
    const adminClient = createAdminClient()

    await adminClient.from('voice_channel_participants').upsert({
      channel_id: channelId,
      user_id: AI_BOT_USER_ID,
      is_muted: false,
      is_video_on: false,
    }, { onConflict: 'channel_id,user_id' })

    const { data: session, error: sessionError } = await adminClient
      .from('ai_sessions')
      .insert({ voice_channel_id: channelId, host_user_id: user!.id, status: 'active' })
      .select('id')
      .single()

    if (sessionError) {
      console.error('Session creation error:', sessionError)
      return NextResponse.json({ error: 'Failed to create bot session' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: `${botConfig.name} activated`,
      sessionId: session.id,
      botName: botConfig.name,
      clientSecret: tokenData.value,
      model,
      voice,
      triggerPhrases: botConfig.trigger_phrases ?? ['Bot', 'Hey Bot'],
    })
  } catch (err) {
    console.error('Bot join error:', err)
    return NextResponse.json({ error: 'Failed to activate bot' }, { status: 500 })
  }
}

/**
 * Check if bot is active and who's hosting it.
 */
export async function GET(request: NextRequest) {
  try {
    const { supabase, user, error } = await createClientFromRequest(request)
    if (error) return NextResponse.json({ error }, { status: 401 })

    const channelId = request.nextUrl.searchParams.get('channelId')
    if (!channelId) {
      return NextResponse.json({ error: 'Channel ID required' }, { status: 400 })
    }

    const { data: session } = await supabase
      .from('ai_sessions')
      .select('id, host_user_id, status, started_at')
      .eq('voice_channel_id', channelId)
      .eq('status', 'active')
      .single()

    if (!session) {
      return NextResponse.json({ isActive: false })
    }

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
      isCurrentUserHost: session.host_user_id === user!.id,
      startedAt: session.started_at,
    })
  } catch (err) {
    console.error('Bot status error:', err)
    return NextResponse.json({ error: 'Failed to get bot status' }, { status: 500 })
  }
}
