import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'

export async function GET() {
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

    const { data, error } = await supabase
      .from('ai_bot_config')
      .select('*')
      .single()

    if (error) {
      console.error('Failed to load bot config:', error)
      return NextResponse.json(
        { error: 'Failed to load bot configuration' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      id: data.id,
      name: data.name ?? 'Bot',
      avatarUrl: data.avatar_url ?? '/images/ai-bot-avatar.png',
      voice: data.voice ?? 'alloy',
      isEnabled: data.is_enabled ?? true,
      triggerPhrases: data.trigger_phrases ?? ['Bot', 'Hey Bot'],
    })
  } catch (error) {
    console.error('Bot config GET error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
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

    // Check if user is admin
    const { data: profile } = await supabase
      .from('users')
      .select('is_admin')
      .eq('id', user.id)
      .single()

    if (!profile?.is_admin) {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { name, avatarUrl, voice, isEnabled, triggerPhrases } = body

    // Get current config ID
    const { data: currentConfig } = await supabase
      .from('ai_bot_config')
      .select('id')
      .single()

    if (!currentConfig) {
      return NextResponse.json(
        { error: 'Bot config not found' },
        { status: 404 }
      )
    }

    // Update config
    const { error: updateError } = await supabase
      .from('ai_bot_config')
      .update({
        name,
        avatar_url: avatarUrl,
        voice,
        is_enabled: isEnabled,
        trigger_phrases: triggerPhrases,
        updated_at: new Date().toISOString(),
        updated_by: user.id,
      })
      .eq('id', currentConfig.id)

    if (updateError) {
      console.error('Failed to update bot config:', updateError)
      return NextResponse.json(
        { error: 'Failed to update bot configuration' },
        { status: 500 }
      )
    }

    // Also update the bot user's name and avatar to stay in sync
    const AI_BOT_USER_ID = '00000000-0000-0000-0000-000000000001'
    if (name || avatarUrl) {
      const userUpdate: Record<string, string> = {}
      if (name) userUpdate.name = name
      if (avatarUrl) userUpdate.avatar_url = avatarUrl

      await supabase
        .from('users')
        .update(userUpdate)
        .eq('id', AI_BOT_USER_ID)
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Bot config PUT error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
