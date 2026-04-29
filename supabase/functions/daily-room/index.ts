import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const DAILY_API_URL = 'https://api.daily.co/v1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

interface DailyRoom {
  id: string
  name: string
  url: string
  created_at: string
  config: Record<string, unknown>
}

async function getDailyRoom(roomName: string, apiKey: string): Promise<DailyRoom | null> {
  const res = await fetch(`${DAILY_API_URL}/rooms/${roomName}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  })
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`Failed to get room: ${res.statusText}`)
  return res.json()
}

async function createDailyRoom(roomName: string, apiKey: string): Promise<DailyRoom> {
  const res = await fetch(`${DAILY_API_URL}/rooms`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
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
        exp: Math.floor(Date.now() / 1000) + 86400,
        eject_at_room_exp: true,
      },
    }),
  })
  if (!res.ok) throw new Error(`Failed to create room: ${res.statusText}`)
  return res.json()
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  try {
    const apiKey = Deno.env.get('DAILY_API_KEY')
    if (!apiKey) throw new Error('Missing DAILY_API_KEY secret')

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    // Verify caller is authenticated
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { channelId } = await req.json()
    if (!channelId) {
      return new Response(JSON.stringify({ error: 'channelId required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: channel, error: channelError } = await supabase
      .from('voice_channels')
      .select('id, daily_room_name, daily_room_url')
      .eq('id', channelId)
      .single()

    if (channelError || !channel) {
      return new Response(JSON.stringify({ error: 'Channel not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const roomName = channel.daily_room_name || `taskflow-${channelId}`
    const existing = await getDailyRoom(roomName, apiKey)
    const room = existing ?? await createDailyRoom(roomName, apiKey)

    // Persist room details if not already stored
    if (!channel.daily_room_url) {
      await supabase
        .from('voice_channels')
        .update({ daily_room_name: room.name, daily_room_url: room.url })
        .eq('id', channelId)
    }

    return new Response(
      JSON.stringify({ roomName: room.name, roomUrl: room.url }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    console.error('daily-room error:', err)
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
