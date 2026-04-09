import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'

const DAILY_API_KEY = process.env.DAILY_API_KEY!
const DAILY_API_URL = 'https://api.daily.co/v1'

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

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const supabase = createClient(cookieStore)
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders })
    }

    const { data: profile } = await supabase
      .from('users')
      .select('name, avatar_url')
      .eq('id', user.id)
      .single()

    const { roomName } = await request.json()

    if (!roomName) {
      return NextResponse.json({ error: 'Room name required' }, { status: 400, headers: corsHeaders })
    }

    const response = await fetch(`${DAILY_API_URL}/meeting-tokens`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${DAILY_API_KEY}`,
      },
      body: JSON.stringify({
        properties: {
          room_name: roomName,
          user_id: user.id,
          user_name: profile?.name || user.email || 'Anonymous',
          exp: Math.floor(Date.now() / 1000) + 86400,
          enable_screenshare: true,
          start_video_off: true,
          start_audio_off: false,
        },
      }),
    })

    if (!response.ok) {
      throw new Error(`Failed to create token: ${response.statusText}`)
    }

    const { token } = await response.json()

    return NextResponse.json({
      token,
      avatarUrl: profile?.avatar_url || null,
    }, { headers: corsHeaders })
  } catch (error) {
    console.error('Token generation error:', error)
    return NextResponse.json(
      { error: 'Failed to generate token' },
      { status: 500, headers: corsHeaders }
    )
  }
}
