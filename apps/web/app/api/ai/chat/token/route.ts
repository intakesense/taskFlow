import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'

/**
 * Generate an ephemeral token for direct AI voice chat.
 * This is separate from the voice channel bot - used for 1-on-1 AI conversations.
 */
export async function POST(request: NextRequest) {
  try {
    console.log('[AIChat:Server] Token request received')

    const cookieStore = await cookies()
    const supabase = createClient(cookieStore)

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      console.warn('[AIChat:Server] Unauthorized token request')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.log('[AIChat:Server] Authenticated user:', user.id)

    // Request ephemeral client key from OpenAI (per quickstart guide)
    // https://openai.github.io/openai-agents-js/guides/voice-agents/quickstart/
    const model = process.env.OPENAI_REALTIME_MODEL
    console.log('[AIChat:Server] Requesting ephemeral key for model:', model)

    const tokenResponse = await fetch('https://api.openai.com/v1/realtime/client_secrets', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        session: {
          type: 'realtime',
          model,
        },
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

    // Response has top-level "value" starting with "ek_" prefix
    const keyPrefix = tokenData.value?.substring(0, 8)
    console.log('[AIChat:Server] ✅ Ephemeral key generated:', keyPrefix + '...')

    return NextResponse.json({
      clientSecret: tokenData.value,
      model,
    })
  } catch (error) {
    console.error('AI chat token error:', error)
    return NextResponse.json(
      { error: 'Failed to start AI chat' },
      { status: 500 }
    )
  }
}