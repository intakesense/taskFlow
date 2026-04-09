import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * Daily.co Webhook Handler
 *
 * To register this webhook with Daily.co, make a POST request:
 *
 * curl -X POST "https://api.daily.co/v1/webhooks" \
 *   -H "Authorization: Bearer YOUR_DAILY_API_KEY" \
 *   -H "Content-Type: application/json" \
 *   -d '{
 *     "url": "https://tms.intakesense.com/api/daily/webhook",
 *     "eventTypes": ["participant.left"]
 *   }'
 *
 * Docs: https://docs.daily.co/reference/rest-api/webhooks/create
 */

interface DailyWebhookPayload {
  event: string
  timestamp: number
  payload: {
    room: string
    participant?: {
      user_id?: string
      user_name?: string
      session_id: string
    }
  }
}

export async function POST(request: NextRequest) {
  try {
    const body: DailyWebhookPayload = await request.json()
    const { event, payload } = body

    // Only handle participant-left events
    if (event !== 'participant.left') {
      return NextResponse.json({ received: true })
    }

    const roomName = payload.room
    const participantUserId = payload.participant?.user_id

    if (!roomName || !participantUserId) {
      return NextResponse.json({ received: true })
    }

    const supabase = createAdminClient()

    // Find the channel by daily_room_name
    const { data: channel } = await supabase
      .from('voice_channels')
      .select('id')
      .eq('daily_room_name', roomName)
      .single()

    if (!channel) {
      console.log(`Webhook: Channel not found for room ${roomName}`)
      return NextResponse.json({ received: true })
    }

    // Remove participant from database
    const { error } = await supabase
      .from('voice_channel_participants')
      .delete()
      .eq('channel_id', channel.id)
      .eq('user_id', participantUserId)

    if (error) {
      console.error('Webhook: Failed to remove participant:', error)
    } else {
      console.log(`Webhook: Removed ${participantUserId} from channel ${channel.id}`)
    }

    // End any open sessions for this user in this channel
    await supabase
      .from('voice_channel_sessions')
      .update({ left_at: new Date().toISOString() })
      .eq('channel_id', channel.id)
      .eq('user_id', participantUserId)
      .is('left_at', null)

    return NextResponse.json({ received: true })
  } catch (error) {
    console.error('Daily webhook error:', error)
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 })
  }
}
