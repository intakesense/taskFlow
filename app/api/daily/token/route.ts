import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'

const DAILY_API_KEY = process.env.DAILY_API_KEY!
const DAILY_API_URL = 'https://api.daily.co/v1'

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

    const { data: profile } = await supabase
      .from('users')
      .select('name, avatar_url')
      .eq('id', user.id)
      .single()

    const { roomName } = await request.json()

    if (!roomName) {
      return NextResponse.json({ error: 'Room name required' }, { status: 400 })
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
    })
  } catch (error) {
    console.error('Token generation error:', error)
    return NextResponse.json(
      { error: 'Failed to generate token' },
      { status: 500 }
    )
  }
}
