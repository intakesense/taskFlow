import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'

const DAILY_API_KEY = process.env.DAILY_API_KEY!

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
const DAILY_API_URL = 'https://api.daily.co/v1'

interface DailyRoom {
  id: string
  name: string
  url: string
  created_at: string
  config: Record<string, unknown>
}

async function createDailyRoom(roomName: string): Promise<DailyRoom> {
  const response = await fetch(`${DAILY_API_URL}/rooms`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${DAILY_API_KEY}`,
    },
    body: JSON.stringify({
      name: roomName,
      privacy: 'private',
      properties: {
        enable_screenshare: true,
        enable_chat: false,
        start_video_off: true,
        start_audio_off: false,
        enable_knocking: false,
        enable_prejoin_ui: false,
        max_participants: 25,
        exp: Math.floor(Date.now() / 1000) + 86400, // 24 hours - room cleanup, not session limit
        eject_at_room_exp: true,
      },
    }),
  })

  if (!response.ok) {
    if (response.status === 400) {
      return getDailyRoom(roomName)
    }
    throw new Error(`Failed to create room: ${response.statusText}`)
  }

  return response.json()
}

async function getDailyRoom(roomName: string): Promise<DailyRoom> {
  const response = await fetch(`${DAILY_API_URL}/rooms/${roomName}`, {
    headers: {
      Authorization: `Bearer ${DAILY_API_KEY}`,
    },
  })

  if (!response.ok) {
    throw new Error(`Failed to get room: ${response.statusText}`)
  }

  return response.json()
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

    const { channelId } = await request.json()

    if (!channelId) {
      return NextResponse.json({ error: 'Channel ID required' }, { status: 400, headers: corsHeaders })
    }

    const { data: channel, error: channelError } = await supabase
      .from('voice_channels')
      .select('*')
      .eq('id', channelId)
      .single()

    if (channelError || !channel) {
      return NextResponse.json({ error: 'Channel not found' }, { status: 404, headers: corsHeaders })
    }

    const roomName = channel.daily_room_name || `taskflow-${channelId}`
    let room: DailyRoom

    try {
      room = await getDailyRoom(roomName)
    } catch {
      room = await createDailyRoom(roomName)
    }

    if (!channel.daily_room_url) {
      await supabase
        .from('voice_channels')
        .update({
          daily_room_name: room.name,
          daily_room_url: room.url,
        })
        .eq('id', channelId)
    }

    return NextResponse.json({
      roomName: room.name,
      roomUrl: room.url,
    }, { headers: corsHeaders })
  } catch (error) {
    console.error('Daily room error:', error)
    return NextResponse.json(
      { error: 'Failed to create/get room' },
      { status: 500, headers: corsHeaders }
    )
  }
}
