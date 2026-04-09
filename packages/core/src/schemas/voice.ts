import { z } from 'zod'

export const voiceChannelSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(50),
  description: z.string().max(200).nullable(),
  created_by: z.string().uuid().nullable(),
  is_default: z.boolean(),
  max_participants: z.number().int().min(2).max(100),
  daily_room_name: z.string().nullable(),
  daily_room_url: z.string().url().nullable(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
})

export const voiceParticipantStateSchema = z.object({
  is_muted: z.boolean().optional(),
  is_video_on: z.boolean().optional(),
  is_screen_sharing: z.boolean().optional(),
  is_speaking: z.boolean().optional(),
  connection_quality: z.enum(['excellent', 'good', 'poor', 'lost']).optional(),
})

export const roomRequestSchema = z.object({
  channelId: z.string().uuid(),
})

export const tokenRequestSchema = z.object({
  roomName: z.string().min(1).max(100),
})

export type VoiceChannelSchema = z.infer<typeof voiceChannelSchema>
export type VoiceParticipantStateSchema = z.infer<typeof voiceParticipantStateSchema>
export type RoomRequestSchema = z.infer<typeof roomRequestSchema>
export type TokenRequestSchema = z.infer<typeof tokenRequestSchema>
