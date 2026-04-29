import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const DAILY_API_URL = 'https://api.daily.co/v1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
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

    // Fetch user profile for display name and avatar
    const { data: profile } = await supabase
      .from('users')
      .select('name, avatar_url')
      .eq('id', user.id)
      .single()

    const { roomName } = await req.json()
    if (!roomName) {
      return new Response(JSON.stringify({ error: 'roomName required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const res = await fetch(`${DAILY_API_URL}/meeting-tokens`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
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

    if (!res.ok) {
      throw new Error(`Failed to create token: ${res.statusText}`)
    }

    const { token: meetingToken } = await res.json()

    return new Response(
      JSON.stringify({ token: meetingToken, avatarUrl: profile?.avatar_url ?? null }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    console.error('daily-token error:', err)
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
