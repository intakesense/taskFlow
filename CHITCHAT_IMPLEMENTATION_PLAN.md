# ChitChat Voice/Video Channel - Complete Implementation Plan

## Executive Summary

This document provides a comprehensive implementation plan for adding a Discord-like voice/video channel called **"ChitChat"** to TaskFlow. The feature allows all users to join a persistent voice channel for real-time audio/video communication with screen sharing capabilities.

| Decision | Choice |
|----------|--------|
| **Technology** | **Daily.co** |
| **Scope** | Voice + Video + Screen Share |
| **UI Location** | Sidebar navigation item |
| **Channel Model** | Single persistent "ChitChat" channel |

---

## Table of Contents

1. [Technology Analysis](#1-technology-analysis)
2. [Architecture Overview](#2-architecture-overview)
3. [Database Schema](#3-database-schema)
4. [Environment Setup](#4-environment-setup)
5. [File Structure](#5-file-structure)
6. [Implementation Details](#6-implementation-details)
   - [Phase 1: Infrastructure Setup](#phase-1-infrastructure-setup)
   - [Phase 2: Core Voice Components](#phase-2-core-voice-components)
   - [Phase 3: Navigation Integration](#phase-3-navigation-integration)
   - [Phase 4: Real-time Participant Sync](#phase-4-real-time-participant-sync)
   - [Phase 5: Polish & Mobile](#phase-5-polish--mobile)
7. [Component Specifications](#7-component-specifications)
8. [Testing Plan](#8-testing-plan)
9. [Cost Analysis](#9-cost-analysis)

---

## 1. Technology Analysis

### Why Daily.co?

| Factor | Daily.co | LiveKit | Agora |
|--------|----------|---------|-------|
| **Free Tier** | **10,000 min/month** | 5,000 min/month | 10,000 min/month |
| **Pricing** | **$0.004/min** | $0.02/min | $0.0049/min |
| **React SDK** | Excellent | Excellent | Good |
| **Ease of Setup** | **Easiest** | Medium | Complex |
| **Pre-built UI** | ✅ Optional | ✅ | ❌ |
| **Screen Share** | ✅ | ✅ | ✅ |
| **Recording** | ✅ Built-in | ✅ | Extra cost |

### Daily.co Advantages

1. **2x Free Minutes**: 10,000 min/month (vs LiveKit's 5,000)
2. **5x Cheaper at Scale**: $0.004/min vs $0.02/min
3. **Simpler Integration**: Room URL approach + React hooks
4. **Excellent React SDK**: `@daily-co/daily-react` with pre-built components
5. **No TURN/STUN Management**: Daily handles all WebRTC infrastructure

### Cost Comparison

| Scenario | Monthly Minutes | Daily.co Cost | LiveKit Cost |
|----------|-----------------|---------------|--------------|
| Casual | 1,800 | $0 | $0 |
| Moderate | 12,000 | **$8** | $140 |
| Heavy | 105,600 | **$382** | $2,012 |

---

## 2. Architecture Overview

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              User's Browser                              │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                     TaskFlow Next.js App                         │    │
│  │  ┌──────────────┐  ┌──────────────┐  ┌────────────────────┐    │    │
│  │  │   Sidebar    │  │  ChitChat    │  │  Voice Channel     │    │    │
│  │  │   Nav Item   │──│  Page        │──│  Panel Component   │    │    │
│  │  │  (Badge)     │  │  /chitchat   │  │  (Daily Room)      │    │    │
│  │  └──────────────┘  └──────────────┘  └─────────┬──────────┘    │    │
│  │                                                 │               │    │
│  │  ┌──────────────────────────────────────────────┼──────────┐   │    │
│  │  │              VoiceChannelContext             │          │   │    │
│  │  │  - isConnected, isMuted, isVideoEnabled     │          │   │    │
│  │  │  - participants[], joinChannel(), leave()    │          │   │    │
│  │  └──────────────────────────────────────────────┼──────────┘   │    │
│  └─────────────────────────────────────────────────┼───────────────┘    │
│                                                    │                     │
└────────────────────────────────────────────────────┼─────────────────────┘
                                                     │
                    WebRTC Media Streams             │  REST API
                    (Audio/Video/Screen)             │  (Room Creation)
                                                     │
              ┌──────────────────────────────────────┼─────────────────┐
              │                                      ▼                 │
              │  ┌─────────────────────┐    ┌─────────────────────┐   │
              │  │   Daily.co          │    │  Next.js API Route  │   │
              │  │   (SFU Server)      │    │  /api/daily/room    │   │
              │  │                     │    │                     │   │
              │  │  - WebRTC Signaling │    │  - Creates rooms    │   │
              │  │  - Media Routing    │    │  - Returns room URL │   │
              │  │  - TURN/STUN        │    │  - Generates tokens │   │
              │  └─────────────────────┘    └──────────┬──────────┘   │
              │                                        │              │
              │  Cloud Infrastructure                  │              │
              └────────────────────────────────────────┼──────────────┘
                                                       │
                                                       ▼
              ┌────────────────────────────────────────────────────────┐
              │                   Supabase                             │
              │  ┌─────────────────────┐    ┌─────────────────────┐   │
              │  │   PostgreSQL        │    │   Realtime          │   │
              │  │                     │    │                     │   │
              │  │  - voice_channels   │◄───│  - Participant      │   │
              │  │  - voice_channel_   │    │    presence updates │   │
              │  │    participants     │    │  - Join/leave       │   │
              │  └─────────────────────┘    └─────────────────────┘   │
              │                                                        │
              └────────────────────────────────────────────────────────┘
```

### Data Flow

1. **User clicks "Join ChitChat"**
   - App calls `/api/daily/room` to get/create room
   - API returns Daily room URL and meeting token
   - Client connects using `@daily-co/daily-react`

2. **Client connects to Daily**
   - Daily SDK handles WebRTC connection
   - User added to `voice_channel_participants` table
   - Real-time sync broadcasts join event

3. **Real-time sync**
   - Supabase Realtime broadcasts participant changes
   - All connected clients update their participant lists
   - Sidebar badge updates with current count

4. **User leaves channel**
   - Daily connection closed
   - User removed from `voice_channel_participants`
   - Realtime notifies other clients

---

## 3. Database Schema

### Migration File

Create file: `supabase/migrations/20250127000000_voice_channels.sql`

```sql
-- ============================================================================
-- VOICE CHANNELS SCHEMA
-- Implements Discord-like voice channel functionality for TaskFlow
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Voice Channels Table
-- Stores voice channel metadata (single "ChitChat" channel for MVP)
-- ----------------------------------------------------------------------------
CREATE TABLE voice_channels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    is_default BOOLEAN DEFAULT FALSE,
    max_participants INT DEFAULT 25,
    -- Daily.co room configuration
    daily_room_name TEXT UNIQUE,  -- Daily room name (persistent)
    daily_room_url TEXT,          -- Daily room URL
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for quick default channel lookup
CREATE INDEX idx_voice_channels_default ON voice_channels(is_default) WHERE is_default = TRUE;

-- Updated_at trigger
CREATE TRIGGER update_voice_channels_updated_at
    BEFORE UPDATE ON voice_channels
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ----------------------------------------------------------------------------
-- Voice Channel Participants Table
-- Tracks who is currently in each voice channel with their state
-- ----------------------------------------------------------------------------
CREATE TABLE voice_channel_participants (
    channel_id UUID REFERENCES voice_channels(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    joined_at TIMESTAMPTZ DEFAULT NOW(),

    -- Participant state (synced from Daily for UI display)
    is_muted BOOLEAN DEFAULT FALSE,
    is_video_on BOOLEAN DEFAULT FALSE,
    is_screen_sharing BOOLEAN DEFAULT FALSE,
    is_speaking BOOLEAN DEFAULT FALSE,

    -- Connection quality (optional, for UI indicators)
    connection_quality TEXT DEFAULT 'good' CHECK (connection_quality IN ('excellent', 'good', 'poor', 'lost')),

    PRIMARY KEY (channel_id, user_id)
);

-- Index for channel participant lookups
CREATE INDEX idx_voice_participants_channel ON voice_channel_participants(channel_id);
CREATE INDEX idx_voice_participants_user ON voice_channel_participants(user_id);

-- ----------------------------------------------------------------------------
-- Voice Channel Sessions Table (Optional - for analytics/history)
-- Logs voice channel usage for analytics
-- ----------------------------------------------------------------------------
CREATE TABLE voice_channel_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    channel_id UUID REFERENCES voice_channels(id) ON DELETE SET NULL,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    joined_at TIMESTAMPTZ NOT NULL,
    left_at TIMESTAMPTZ,
    duration_seconds INT GENERATED ALWAYS AS (
        EXTRACT(EPOCH FROM (COALESCE(left_at, NOW()) - joined_at))::INT
    ) STORED
);

-- Index for session history queries
CREATE INDEX idx_voice_sessions_user ON voice_channel_sessions(user_id);
CREATE INDEX idx_voice_sessions_channel ON voice_channel_sessions(channel_id);
CREATE INDEX idx_voice_sessions_date ON voice_channel_sessions(joined_at);

-- ----------------------------------------------------------------------------
-- Enable Realtime for participant tracking
-- ----------------------------------------------------------------------------
ALTER PUBLICATION supabase_realtime ADD TABLE voice_channel_participants;

-- ----------------------------------------------------------------------------
-- Row Level Security Policies
-- ----------------------------------------------------------------------------

-- Voice Channels: All authenticated users can view
ALTER TABLE voice_channels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view voice channels"
ON voice_channels FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Admins can manage voice channels"
ON voice_channels FOR ALL
TO authenticated
USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND is_admin = true)
);

-- Voice Channel Participants: All authenticated users can view, manage own
ALTER TABLE voice_channel_participants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view participants"
ON voice_channel_participants FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Users can join channels (insert own record)"
ON voice_channel_participants FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own participation state"
ON voice_channel_participants FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can leave channels (delete own record)"
ON voice_channel_participants FOR DELETE
TO authenticated
USING (user_id = auth.uid());

-- Voice Channel Sessions: Users can view own, admins can view all
ALTER TABLE voice_channel_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own session history"
ON voice_channel_sessions FOR SELECT
TO authenticated
USING (
    user_id = auth.uid() OR
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND is_admin = true)
);

CREATE POLICY "System can create sessions"
ON voice_channel_sessions FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "System can update sessions"
ON voice_channel_sessions FOR UPDATE
TO authenticated
USING (user_id = auth.uid());

-- ----------------------------------------------------------------------------
-- Seed default ChitChat channel
-- ----------------------------------------------------------------------------
INSERT INTO voice_channels (name, description, is_default, daily_room_name)
VALUES (
    'ChitChat',
    'General voice channel for team discussions. Jump in anytime!',
    true,
    'taskflow-chitchat'
);

-- ----------------------------------------------------------------------------
-- Helper Functions
-- ----------------------------------------------------------------------------

-- Get participant count for a channel
CREATE OR REPLACE FUNCTION get_voice_channel_participant_count(p_channel_id UUID)
RETURNS INT
LANGUAGE SQL
STABLE
AS $$
    SELECT COUNT(*)::INT
    FROM voice_channel_participants
    WHERE channel_id = p_channel_id;
$$;

-- Get default voice channel ID
CREATE OR REPLACE FUNCTION get_default_voice_channel_id()
RETURNS UUID
LANGUAGE SQL
STABLE
AS $$
    SELECT id FROM voice_channels WHERE is_default = TRUE LIMIT 1;
$$;

-- Clean up stale participants (for cron job - users who disconnected unexpectedly)
CREATE OR REPLACE FUNCTION cleanup_stale_voice_participants()
RETURNS INT
LANGUAGE plpgsql
AS $$
DECLARE
    deleted_count INT;
BEGIN
    -- Delete participants who joined more than 24 hours ago
    -- (They likely disconnected without proper cleanup)
    DELETE FROM voice_channel_participants
    WHERE joined_at < NOW() - INTERVAL '24 hours';

    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$;
```

### TypeScript Types

Add to `lib/types.ts`:

```typescript
// Voice Channel Types
export interface VoiceChannel {
  id: string
  name: string
  description: string | null
  created_by: string | null
  is_default: boolean
  max_participants: number
  daily_room_name: string | null
  daily_room_url: string | null
  created_at: string
  updated_at: string
}

export interface VoiceChannelParticipant {
  channel_id: string
  user_id: string
  joined_at: string
  is_muted: boolean
  is_video_on: boolean
  is_screen_sharing: boolean
  is_speaking: boolean
  connection_quality: 'excellent' | 'good' | 'poor' | 'lost'
}

export interface VoiceParticipantWithUser extends VoiceChannelParticipant {
  user: User
}

export interface VoiceChannelSession {
  id: string
  channel_id: string | null
  user_id: string | null
  joined_at: string
  left_at: string | null
  duration_seconds: number
}

// Daily.co specific types
export interface DailyRoomInfo {
  url: string
  token: string
  roomName: string
}
```

---

## 4. Environment Setup

### Daily.co Setup

1. **Create Account**
   - Go to https://dashboard.daily.co
   - Sign up / Sign in

2. **Get API Key**
   - Navigate to Developers → API Keys
   - Copy your API key

3. **Note Your Domain**
   - Your domain is shown in the dashboard (e.g., `your-domain.daily.co`)

### Environment Variables

Add to `.env.local`:

```env
# Daily.co Configuration
DAILY_API_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
NEXT_PUBLIC_DAILY_DOMAIN=your-domain.daily.co
```

### Install Dependencies

```bash
# Daily.co React SDK
pnpm add @daily-co/daily-js @daily-co/daily-react
```

---

## 5. File Structure

```
task-management/
├── app/
│   ├── chitchat/
│   │   └── page.tsx                          # Voice channel page route
│   └── api/
│       └── daily/
│           ├── room/route.ts                 # Create/get room endpoint
│           └── token/route.ts                # Generate meeting token
│
├── components/
│   └── voice/
│       ├── voice-channel-provider.tsx        # Daily + Context provider
│       ├── voice-channel-panel.tsx           # Main voice UI container
│       ├── voice-channel-nav-item.tsx        # Sidebar nav with badge
│       ├── participant-grid.tsx              # Grid layout for participants
│       ├── participant-tile.tsx              # Individual participant tile
│       ├── voice-controls.tsx                # Mic/camera/share controls
│       ├── speaking-indicator.tsx            # Audio level visualization
│       └── device-settings-dialog.tsx        # Audio/video device picker
│
├── hooks/
│   ├── use-voice-channel.ts                  # Main voice channel hook
│   ├── use-voice-participants.ts             # Real-time participant list
│   └── use-daily-room.ts                     # Daily room management
│
├── lib/
│   ├── voice/
│   │   ├── voice-channel-context.tsx         # React context for voice state
│   │   ├── daily-config.ts                   # Daily.co configuration
│   │   └── constants.ts                      # Voice-related constants
│   │
│   ├── services/
│   │   └── voice-channels.ts                 # Database operations
│   │
│   └── schemas/
│       └── voice.ts                          # Zod validation schemas
│
└── supabase/
    └── migrations/
        └── 20250127000000_voice_channels.sql # Database migration
```

---

## 6. Implementation Details

### Phase 1: Infrastructure Setup

#### 1.1 Daily.co Room Management API

Create `app/api/daily/room/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const DAILY_API_KEY = process.env.DAILY_API_KEY!
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
      privacy: 'private', // Requires token to join
      properties: {
        enable_screenshare: true,
        enable_chat: false, // We use our own chat
        start_video_off: true,
        start_audio_off: false,
        enable_knocking: false,
        enable_prejoin_ui: false,
        max_participants: 25,
        // Auto-delete room after 24 hours of inactivity
        exp: Math.floor(Date.now() / 1000) + 86400 * 30, // 30 days
        eject_at_room_exp: true,
      },
    }),
  })

  if (!response.ok) {
    // Room might already exist, try to get it
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
    // Verify authentication
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { channelId } = await request.json()

    if (!channelId) {
      return NextResponse.json({ error: 'Channel ID required' }, { status: 400 })
    }

    // Get channel from database
    const { data: channel, error: channelError } = await supabase
      .from('voice_channels')
      .select('*')
      .eq('id', channelId)
      .single()

    if (channelError || !channel) {
      return NextResponse.json({ error: 'Channel not found' }, { status: 404 })
    }

    // Create or get Daily room
    const roomName = channel.daily_room_name || `taskflow-${channelId}`
    let room: DailyRoom

    try {
      room = await getDailyRoom(roomName)
    } catch {
      room = await createDailyRoom(roomName)
    }

    // Update channel with room info if needed
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
    })
  } catch (error) {
    console.error('Daily room error:', error)
    return NextResponse.json(
      { error: 'Failed to create/get room' },
      { status: 500 }
    )
  }
}
```

#### 1.2 Daily.co Token Generation API

Create `app/api/daily/token/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const DAILY_API_KEY = process.env.DAILY_API_KEY!
const DAILY_API_URL = 'https://api.daily.co/v1'

export async function POST(request: NextRequest) {
  try {
    // Verify authentication
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user profile
    const { data: profile } = await supabase
      .from('users')
      .select('name, avatar_url')
      .eq('id', user.id)
      .single()

    const { roomName } = await request.json()

    if (!roomName) {
      return NextResponse.json({ error: 'Room name required' }, { status: 400 })
    }

    // Generate meeting token
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
          // Token expires in 24 hours
          exp: Math.floor(Date.now() / 1000) + 86400,
          // Permissions
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

    return NextResponse.json({ token })
  } catch (error) {
    console.error('Token generation error:', error)
    return NextResponse.json(
      { error: 'Failed to generate token' },
      { status: 500 }
    )
  }
}
```

#### 1.3 Voice Channel Service

Create `lib/services/voice-channels.ts`:

```typescript
import { supabase } from '@/lib/supabase/client'
import type {
  VoiceChannel,
  VoiceChannelParticipant,
  VoiceParticipantWithUser,
  DailyRoomInfo,
} from '@/lib/types'

export const voiceChannelService = {
  /**
   * Get all voice channels
   */
  async getChannels(): Promise<VoiceChannel[]> {
    const { data, error } = await supabase
      .from('voice_channels')
      .select('*')
      .order('is_default', { ascending: false })
      .order('name')

    if (error) throw error
    return data || []
  },

  /**
   * Get the default voice channel
   */
  async getDefaultChannel(): Promise<VoiceChannel | null> {
    const { data, error } = await supabase
      .from('voice_channels')
      .select('*')
      .eq('is_default', true)
      .single()

    if (error && error.code !== 'PGRST116') throw error
    return data
  },

  /**
   * Get participants for a channel with user details
   */
  async getParticipants(channelId: string): Promise<VoiceParticipantWithUser[]> {
    const { data, error } = await supabase
      .from('voice_channel_participants')
      .select(`
        *,
        user:users(id, name, email, avatar_url, level)
      `)
      .eq('channel_id', channelId)
      .order('joined_at')

    if (error) throw error
    return (data || []) as VoiceParticipantWithUser[]
  },

  /**
   * Get or create Daily room for a channel
   */
  async getRoom(channelId: string): Promise<{ roomName: string; roomUrl: string }> {
    const response = await fetch('/api/daily/room', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ channelId }),
    })

    if (!response.ok) {
      throw new Error('Failed to get room')
    }

    return response.json()
  },

  /**
   * Get Daily meeting token
   */
  async getToken(roomName: string): Promise<string> {
    const response = await fetch('/api/daily/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roomName }),
    })

    if (!response.ok) {
      throw new Error('Failed to get token')
    }

    const { token } = await response.json()
    return token
  },

  /**
   * Join a voice channel (database record)
   */
  async joinChannel(channelId: string, userId: string): Promise<void> {
    const { error } = await supabase
      .from('voice_channel_participants')
      .upsert({
        channel_id: channelId,
        user_id: userId,
        joined_at: new Date().toISOString(),
        is_muted: false,
        is_video_on: false,
        is_screen_sharing: false,
        is_speaking: false,
      })

    if (error) throw error
  },

  /**
   * Leave a voice channel (database record)
   */
  async leaveChannel(channelId: string, userId: string): Promise<void> {
    const { error } = await supabase
      .from('voice_channel_participants')
      .delete()
      .eq('channel_id', channelId)
      .eq('user_id', userId)

    if (error) throw error
  },

  /**
   * Update participant state (muted, video, etc.)
   */
  async updateParticipantState(
    channelId: string,
    userId: string,
    state: Partial<Pick<VoiceChannelParticipant,
      'is_muted' | 'is_video_on' | 'is_screen_sharing' | 'is_speaking' | 'connection_quality'
    >>
  ): Promise<void> {
    const { error } = await supabase
      .from('voice_channel_participants')
      .update(state)
      .eq('channel_id', channelId)
      .eq('user_id', userId)

    if (error) throw error
  },

  /**
   * Get participant count for a channel
   */
  async getParticipantCount(channelId: string): Promise<number> {
    const { count, error } = await supabase
      .from('voice_channel_participants')
      .select('*', { count: 'exact', head: true })
      .eq('channel_id', channelId)

    if (error) throw error
    return count || 0
  },

  /**
   * Log session start
   */
  async startSession(channelId: string, userId: string): Promise<string> {
    const { data, error } = await supabase
      .from('voice_channel_sessions')
      .insert({
        channel_id: channelId,
        user_id: userId,
        joined_at: new Date().toISOString(),
      })
      .select('id')
      .single()

    if (error) throw error
    return data.id
  },

  /**
   * Log session end
   */
  async endSession(sessionId: string): Promise<void> {
    const { error } = await supabase
      .from('voice_channel_sessions')
      .update({ left_at: new Date().toISOString() })
      .eq('id', sessionId)

    if (error) throw error
  },
}
```

#### 1.4 Zod Schemas

Create `lib/schemas/voice.ts`:

```typescript
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
```

---

### Phase 2: Core Voice Components

#### 2.1 Voice Channel Context

Create `lib/voice/voice-channel-context.tsx`:

```typescript
'use client'

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
  type ReactNode,
} from 'react'
import DailyIframe, { DailyCall, DailyEvent, DailyParticipant } from '@daily-co/daily-js'
import { useAuth } from '@/lib/auth-context'
import { voiceChannelService } from '@/lib/services/voice-channels'
import { toast } from 'sonner'
import type { VoiceChannel } from '@/lib/types'

interface VoiceChannelState {
  // Connection state
  isConnected: boolean
  isConnecting: boolean

  // Current channel
  currentChannel: VoiceChannel | null
  channelId: string | null

  // Local state
  isMuted: boolean
  isVideoEnabled: boolean
  isScreenSharing: boolean

  // Daily call instance
  callObject: DailyCall | null

  // Room info
  roomUrl: string | null

  // Actions
  joinChannel: (channel: VoiceChannel) => Promise<void>
  leaveChannel: () => Promise<void>
  toggleMute: () => void
  toggleVideo: () => Promise<void>
  toggleScreenShare: () => Promise<void>
}

const VoiceChannelContext = createContext<VoiceChannelState | null>(null)

export function VoiceChannelProvider({ children }: { children: ReactNode }) {
  const { effectiveUser } = useAuth()

  // Connection state
  const [isConnected, setIsConnected] = useState(false)
  const [isConnecting, setIsConnecting] = useState(false)

  // Channel state
  const [currentChannel, setCurrentChannel] = useState<VoiceChannel | null>(null)
  const [roomUrl, setRoomUrl] = useState<string | null>(null)

  // Local media state
  const [isMuted, setIsMuted] = useState(false)
  const [isVideoEnabled, setIsVideoEnabled] = useState(false)
  const [isScreenSharing, setIsScreenSharing] = useState(false)

  // Daily call object
  const callObjectRef = useRef<DailyCall | null>(null)
  const sessionIdRef = useRef<string | null>(null)

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (callObjectRef.current) {
        callObjectRef.current.destroy()
      }
    }
  }, [])

  // Sync state to Supabase when it changes
  useEffect(() => {
    if (!currentChannel || !effectiveUser || !isConnected) return

    const syncState = async () => {
      try {
        await voiceChannelService.updateParticipantState(
          currentChannel.id,
          effectiveUser.id,
          {
            is_muted: isMuted,
            is_video_on: isVideoEnabled,
            is_screen_sharing: isScreenSharing,
          }
        )
      } catch (error) {
        console.error('Failed to sync participant state:', error)
      }
    }

    syncState()
  }, [isMuted, isVideoEnabled, isScreenSharing, currentChannel, effectiveUser, isConnected])

  const joinChannel = useCallback(async (channel: VoiceChannel) => {
    if (!effectiveUser) {
      toast.error('You must be logged in to join voice channels')
      return
    }

    if (isConnecting || isConnected) {
      toast.error('Already connected to a channel')
      return
    }

    setIsConnecting(true)

    try {
      // Get Daily room info
      const { roomName, roomUrl: url } = await voiceChannelService.getRoom(channel.id)
      setRoomUrl(url)

      // Get meeting token
      const token = await voiceChannelService.getToken(roomName)

      // Create Daily call object
      const callObject = DailyIframe.createCallObject({
        audioSource: true,
        videoSource: false, // Start with video off
        dailyConfig: {
          experimentalChromeVideoMuteLightOff: true,
        },
      })

      // Set up event listeners
      callObject.on('joined-meeting', () => {
        setIsConnected(true)
        setIsConnecting(false)
        toast.success(`Joined ${channel.name}`)
      })

      callObject.on('left-meeting', () => {
        setIsConnected(false)
        setCurrentChannel(null)
        setRoomUrl(null)
        callObjectRef.current = null
      })

      callObject.on('error', (event) => {
        console.error('Daily error:', event)
        toast.error('Voice channel error occurred')
      })

      callObject.on('participant-updated', (event) => {
        if (event?.participant?.local) {
          const p = event.participant
          setIsMuted(!p.audio)
          setIsVideoEnabled(!!p.video)
          setIsScreenSharing(!!p.screen)
        }
      })

      // Join the room
      await callObject.join({ url, token })
      callObjectRef.current = callObject

      // Join channel in database
      await voiceChannelService.joinChannel(channel.id, effectiveUser.id)

      // Start session logging
      sessionIdRef.current = await voiceChannelService.startSession(
        channel.id,
        effectiveUser.id
      )

      setCurrentChannel(channel)
    } catch (error) {
      console.error('Failed to join channel:', error)
      toast.error('Failed to join voice channel')
      setIsConnecting(false)
      setRoomUrl(null)
    }
  }, [effectiveUser, isConnecting, isConnected])

  const leaveChannel = useCallback(async () => {
    if (!callObjectRef.current || !currentChannel || !effectiveUser) return

    try {
      // Leave Daily room
      await callObjectRef.current.leave()
      callObjectRef.current.destroy()

      // Leave channel in database
      await voiceChannelService.leaveChannel(currentChannel.id, effectiveUser.id)

      // End session
      if (sessionIdRef.current) {
        await voiceChannelService.endSession(sessionIdRef.current)
        sessionIdRef.current = null
      }

      toast.success(`Left ${currentChannel.name}`)
    } catch (error) {
      console.error('Failed to leave channel:', error)
    } finally {
      callObjectRef.current = null
      setCurrentChannel(null)
      setRoomUrl(null)
      setIsConnected(false)
      setIsMuted(false)
      setIsVideoEnabled(false)
      setIsScreenSharing(false)
    }
  }, [currentChannel, effectiveUser])

  const toggleMute = useCallback(() => {
    if (!callObjectRef.current) return
    callObjectRef.current.setLocalAudio(isMuted) // Toggle: if muted, enable; if not, disable
    setIsMuted(!isMuted)
  }, [isMuted])

  const toggleVideo = useCallback(async () => {
    if (!callObjectRef.current) return

    try {
      await callObjectRef.current.setLocalVideo(!isVideoEnabled)
      setIsVideoEnabled(!isVideoEnabled)
    } catch (error) {
      console.error('Failed to toggle video:', error)
      toast.error('Failed to toggle camera')
    }
  }, [isVideoEnabled])

  const toggleScreenShare = useCallback(async () => {
    if (!callObjectRef.current) return

    try {
      if (isScreenSharing) {
        await callObjectRef.current.stopScreenShare()
      } else {
        await callObjectRef.current.startScreenShare()
      }
      setIsScreenSharing(!isScreenSharing)
    } catch (error) {
      console.error('Failed to toggle screen share:', error)
      toast.error('Failed to toggle screen share')
    }
  }, [isScreenSharing])

  const value: VoiceChannelState = {
    isConnected,
    isConnecting,
    currentChannel,
    channelId: currentChannel?.id || null,
    isMuted,
    isVideoEnabled,
    isScreenSharing,
    callObject: callObjectRef.current,
    roomUrl,
    joinChannel,
    leaveChannel,
    toggleMute,
    toggleVideo,
    toggleScreenShare,
  }

  return (
    <VoiceChannelContext.Provider value={value}>
      {children}
    </VoiceChannelContext.Provider>
  )
}

export function useVoiceChannel() {
  const context = useContext(VoiceChannelContext)
  if (!context) {
    throw new Error('useVoiceChannel must be used within a VoiceChannelProvider')
  }
  return context
}
```

#### 2.2 Voice Participants Hook

Create `hooks/use-voice-participants.ts`:

```typescript
'use client'

import { useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase/client'
import { voiceChannelService } from '@/lib/services/voice-channels'
import type { VoiceParticipantWithUser } from '@/lib/types'

export const voiceParticipantKeys = {
  all: ['voice-participants'] as const,
  channel: (channelId: string) => [...voiceParticipantKeys.all, channelId] as const,
}

export function useVoiceParticipants(channelId: string | null) {
  const queryClient = useQueryClient()

  // Fetch participants
  const {
    data: participants = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: voiceParticipantKeys.channel(channelId || ''),
    queryFn: () => voiceChannelService.getParticipants(channelId!),
    enabled: !!channelId,
    staleTime: 10000, // 10 seconds
  })

  // Real-time subscription for participant changes
  useEffect(() => {
    if (!channelId) return

    const channel = supabase
      .channel(`voice-participants:${channelId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'voice_channel_participants',
          filter: `channel_id=eq.${channelId}`,
        },
        () => {
          // Invalidate and refetch on any change
          queryClient.invalidateQueries({
            queryKey: voiceParticipantKeys.channel(channelId),
          })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [channelId, queryClient])

  return {
    participants,
    participantCount: participants.length,
    isLoading,
    error,
  }
}

// Hook to get just the participant count (for badges)
export function useVoiceParticipantCount(channelId: string | null) {
  const queryClient = useQueryClient()

  const { data: count = 0 } = useQuery({
    queryKey: [...voiceParticipantKeys.channel(channelId || ''), 'count'],
    queryFn: () => voiceChannelService.getParticipantCount(channelId!),
    enabled: !!channelId,
    staleTime: 5000,
  })

  // Real-time subscription for count updates
  useEffect(() => {
    if (!channelId) return

    const channel = supabase
      .channel(`voice-count:${channelId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'voice_channel_participants',
          filter: `channel_id=eq.${channelId}`,
        },
        () => {
          queryClient.invalidateQueries({
            queryKey: [...voiceParticipantKeys.channel(channelId), 'count'],
          })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [channelId, queryClient])

  return count
}
```

#### 2.3 Voice Channel Panel Component

Create `components/voice/voice-channel-panel.tsx`:

```typescript
'use client'

import { useEffect } from 'react'
import {
  DailyProvider,
  useDaily,
  useParticipantIds,
  useLocalSessionId,
  useDailyEvent,
} from '@daily-co/daily-react'
import { useVoiceChannel } from '@/lib/voice/voice-channel-context'
import { VoiceControls } from './voice-controls'
import { ParticipantGrid } from './participant-grid'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { PhoneOff, Loader2, Wifi } from 'lucide-react'
import { cn } from '@/lib/utils'

interface VoiceChannelPanelProps {
  className?: string
}

function VoiceChannelContent() {
  const participantIds = useParticipantIds()
  const localSessionId = useLocalSessionId()

  return (
    <>
      {/* Participant Grid */}
      <div className="flex-1 p-4 overflow-auto">
        <ParticipantGrid
          participantIds={participantIds}
          localSessionId={localSessionId}
        />
      </div>

      {/* Controls */}
      <div className="border-t p-4 bg-card">
        <VoiceControls />
      </div>
    </>
  )
}

export function VoiceChannelPanel({ className }: VoiceChannelPanelProps) {
  const {
    isConnected,
    isConnecting,
    currentChannel,
    callObject,
    leaveChannel,
  } = useVoiceChannel()

  if (!isConnected && !isConnecting) {
    return null
  }

  if (isConnecting) {
    return (
      <div className={cn('flex flex-col items-center justify-center p-8', className)}>
        <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
        <p className="text-muted-foreground">Connecting to {currentChannel?.name}...</p>
      </div>
    )
  }

  if (!callObject) {
    return null
  }

  return (
    <div className={cn('flex flex-col h-full bg-background', className)}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b bg-card">
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
          <h2 className="font-semibold">{currentChannel?.name}</h2>
          <Badge variant="secondary" className="gap-1">
            <Wifi className="h-3 w-3" />
            Connected
          </Badge>
        </div>
        <Button
          variant="destructive"
          size="sm"
          onClick={leaveChannel}
          className="gap-2"
        >
          <PhoneOff className="h-4 w-4" />
          Leave
        </Button>
      </div>

      {/* Daily Provider wraps the call UI */}
      <DailyProvider callObject={callObject}>
        <VoiceChannelContent />
      </DailyProvider>
    </div>
  )
}
```

#### 2.4 Participant Grid Component

Create `components/voice/participant-grid.tsx`:

```typescript
'use client'

import { ParticipantTile } from './participant-tile'
import { cn } from '@/lib/utils'

interface ParticipantGridProps {
  participantIds: string[]
  localSessionId: string | null
}

export function ParticipantGrid({ participantIds, localSessionId }: ParticipantGridProps) {
  // Sort so local participant is first
  const sortedIds = [...participantIds].sort((a, b) => {
    if (a === localSessionId) return -1
    if (b === localSessionId) return 1
    return 0
  })

  // Determine grid layout based on participant count
  const getGridClass = () => {
    const count = sortedIds.length
    if (count === 1) return 'grid-cols-1 max-w-sm mx-auto'
    if (count === 2) return 'grid-cols-2 max-w-2xl mx-auto'
    if (count <= 4) return 'grid-cols-2'
    if (count <= 6) return 'grid-cols-3'
    if (count <= 9) return 'grid-cols-3'
    return 'grid-cols-4'
  }

  if (sortedIds.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        <p>Waiting for participants...</p>
      </div>
    )
  }

  return (
    <div className={cn('grid gap-4', getGridClass())}>
      {sortedIds.map((id) => (
        <ParticipantTile
          key={id}
          sessionId={id}
          isLocal={id === localSessionId}
        />
      ))}
    </div>
  )
}
```

#### 2.5 Participant Tile Component

Create `components/voice/participant-tile.tsx`:

```typescript
'use client'

import {
  useParticipant,
  useVideoTrack,
  useAudioTrack,
  useScreenShare,
  DailyVideo,
  DailyAudio,
} from '@daily-co/daily-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Mic, MicOff, Video, VideoOff, Monitor } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ParticipantTileProps {
  sessionId: string
  isLocal?: boolean
}

export function ParticipantTile({ sessionId, isLocal }: ParticipantTileProps) {
  const participant = useParticipant(sessionId)
  const videoTrack = useVideoTrack(sessionId)
  const audioTrack = useAudioTrack(sessionId)
  const screenShare = useScreenShare(sessionId)

  if (!participant) return null

  const hasVideo = videoTrack.state === 'playable'
  const hasAudio = audioTrack.state === 'playable'
  const hasScreenShare = screenShare.state === 'playable'
  const isMuted = !participant.audio
  const isSpeaking = participant.isSpeaking

  // Get user info from participant
  const userName = participant.user_name || 'Anonymous'

  return (
    <div
      className={cn(
        'relative aspect-video bg-muted rounded-xl overflow-hidden',
        'border-2 transition-all duration-200',
        isSpeaking ? 'border-green-500 shadow-lg shadow-green-500/20' : 'border-transparent'
      )}
    >
      {/* Video or Screen Share or Avatar */}
      {hasScreenShare ? (
        <DailyVideo
          sessionId={sessionId}
          type="screenVideo"
          className="w-full h-full object-contain bg-black"
        />
      ) : hasVideo ? (
        <DailyVideo
          sessionId={sessionId}
          type="video"
          mirror={isLocal}
          className="w-full h-full object-cover"
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-muted">
          <Avatar className="h-20 w-20">
            <AvatarFallback className="text-2xl bg-primary text-primary-foreground">
              {userName.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
        </div>
      )}

      {/* Audio element (hidden but needed for playback) */}
      {!isLocal && hasAudio && (
        <DailyAudio sessionId={sessionId} />
      )}

      {/* Speaking indicator ring */}
      {isSpeaking && (
        <div className="absolute inset-0 border-4 border-green-500 rounded-xl pointer-events-none" />
      )}

      {/* Name and status overlay */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-3">
        <div className="flex items-center justify-between">
          <span className="text-white text-sm font-medium truncate">
            {userName}
            {isLocal && ' (You)'}
          </span>

          <div className="flex items-center gap-2">
            {hasScreenShare && (
              <Monitor className="h-4 w-4 text-blue-400" />
            )}
            {hasVideo ? (
              <Video className="h-4 w-4 text-white" />
            ) : (
              <VideoOff className="h-4 w-4 text-muted-foreground" />
            )}
            {isMuted ? (
              <MicOff className="h-4 w-4 text-red-400" />
            ) : (
              <Mic className={cn('h-4 w-4', isSpeaking ? 'text-green-400' : 'text-white')} />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
```

#### 2.6 Voice Controls Component

Create `components/voice/voice-controls.tsx`:

```typescript
'use client'

import { useVoiceChannel } from '@/lib/voice/voice-channel-context'
import { Button } from '@/components/ui/button'
import { Toggle } from '@/components/ui/toggle'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  Monitor,
  MonitorOff,
  PhoneOff,
  Settings,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { DeviceSettingsDialog } from './device-settings-dialog'

export function VoiceControls() {
  const {
    isMuted,
    isVideoEnabled,
    isScreenSharing,
    toggleMute,
    toggleVideo,
    toggleScreenShare,
    leaveChannel,
  } = useVoiceChannel()

  return (
    <TooltipProvider>
      <div className="flex items-center justify-center gap-2">
        {/* Microphone Toggle */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Toggle
              pressed={!isMuted}
              onPressedChange={toggleMute}
              className={cn(
                'h-12 w-12 rounded-full',
                isMuted && 'bg-destructive/20 text-destructive hover:bg-destructive/30'
              )}
            >
              {isMuted ? (
                <MicOff className="h-5 w-5" />
              ) : (
                <Mic className="h-5 w-5" />
              )}
            </Toggle>
          </TooltipTrigger>
          <TooltipContent>
            {isMuted ? 'Unmute' : 'Mute'}
          </TooltipContent>
        </Tooltip>

        {/* Camera Toggle */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Toggle
              pressed={isVideoEnabled}
              onPressedChange={toggleVideo}
              className={cn(
                'h-12 w-12 rounded-full',
                !isVideoEnabled && 'text-muted-foreground'
              )}
            >
              {isVideoEnabled ? (
                <Video className="h-5 w-5" />
              ) : (
                <VideoOff className="h-5 w-5" />
              )}
            </Toggle>
          </TooltipTrigger>
          <TooltipContent>
            {isVideoEnabled ? 'Turn off camera' : 'Turn on camera'}
          </TooltipContent>
        </Tooltip>

        {/* Screen Share Toggle */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Toggle
              pressed={isScreenSharing}
              onPressedChange={toggleScreenShare}
              className={cn(
                'h-12 w-12 rounded-full',
                isScreenSharing && 'bg-blue-500/20 text-blue-500'
              )}
            >
              {isScreenSharing ? (
                <Monitor className="h-5 w-5" />
              ) : (
                <MonitorOff className="h-5 w-5" />
              )}
            </Toggle>
          </TooltipTrigger>
          <TooltipContent>
            {isScreenSharing ? 'Stop sharing' : 'Share screen'}
          </TooltipContent>
        </Tooltip>

        {/* Settings */}
        <DeviceSettingsDialog
          trigger={
            <Toggle className="h-12 w-12 rounded-full">
              <Settings className="h-5 w-5" />
            </Toggle>
          }
        />

        {/* Divider */}
        <div className="w-px h-8 bg-border mx-2" />

        {/* Leave Button */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="destructive"
              size="icon"
              className="h-12 w-12 rounded-full"
              onClick={leaveChannel}
            >
              <PhoneOff className="h-5 w-5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Leave channel</TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  )
}
```

#### 2.7 Device Settings Dialog

Create `components/voice/device-settings-dialog.tsx`:

```typescript
'use client'

import { useState, useEffect } from 'react'
import { useDaily, useDevices } from '@daily-co/daily-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Settings, Mic, Volume2, Video } from 'lucide-react'

interface DeviceSettingsDialogProps {
  trigger?: React.ReactNode
}

export function DeviceSettingsDialog({ trigger }: DeviceSettingsDialogProps) {
  const daily = useDaily()
  const {
    microphones,
    speakers,
    cameras,
    setMicrophone,
    setSpeaker,
    setCamera,
    currentMic,
    currentSpeaker,
    currentCam,
  } = useDevices()

  const handleMicChange = (deviceId: string) => {
    setMicrophone(deviceId)
  }

  const handleSpeakerChange = (deviceId: string) => {
    setSpeaker(deviceId)
  }

  const handleCameraChange = (deviceId: string) => {
    setCamera(deviceId)
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="icon">
            <Settings className="h-4 w-4" />
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Audio & Video Settings</DialogTitle>
          <DialogDescription>
            Select your preferred input and output devices
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Microphone */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Mic className="h-4 w-4" />
              Microphone
            </Label>
            <Select
              value={currentMic?.device?.deviceId || ''}
              onValueChange={handleMicChange}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select microphone" />
              </SelectTrigger>
              <SelectContent>
                {microphones.map((device) => (
                  <SelectItem key={device.device.deviceId} value={device.device.deviceId}>
                    {device.device.label || `Microphone ${device.device.deviceId.slice(0, 5)}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Speaker */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Volume2 className="h-4 w-4" />
              Speaker
            </Label>
            <Select
              value={currentSpeaker?.device?.deviceId || ''}
              onValueChange={handleSpeakerChange}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select speaker" />
              </SelectTrigger>
              <SelectContent>
                {speakers.map((device) => (
                  <SelectItem key={device.device.deviceId} value={device.device.deviceId}>
                    {device.device.label || `Speaker ${device.device.deviceId.slice(0, 5)}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Camera */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Video className="h-4 w-4" />
              Camera
            </Label>
            <Select
              value={currentCam?.device?.deviceId || ''}
              onValueChange={handleCameraChange}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select camera" />
              </SelectTrigger>
              <SelectContent>
                {cameras.map((device) => (
                  <SelectItem key={device.device.deviceId} value={device.device.deviceId}>
                    {device.device.label || `Camera ${device.device.deviceId.slice(0, 5)}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
```

---

### Phase 3: Navigation Integration

#### 3.1 Update Sidebar

Modify `components/layout/sidebar.tsx` - add to imports and navigation:

```typescript
// Add to imports
import { Headphones } from 'lucide-react'
import { useVoiceParticipantCount } from '@/hooks/use-voice-participants'
import { useQuery } from '@tanstack/react-query'
import { voiceChannelService } from '@/lib/services/voice-channels'

// Update navigation array
const navigation = [
    { name: 'Messages', href: '/', icon: MessageSquare },
    { name: 'ChitChat', href: '/chitchat', icon: Headphones, showBadge: true },
    { name: 'Tasks', href: '/tasks', icon: ListTodo },
]

// In NavItems component, add badge logic:
function NavItems({ onClick }: { onClick?: () => void }) {
    const pathname = usePathname()
    const { profile } = useAuth()

    // Get default channel for badge
    const { data: defaultChannel } = useQuery({
        queryKey: ['voice-channel', 'default'],
        queryFn: () => voiceChannelService.getDefaultChannel(),
    })

    const participantCount = useVoiceParticipantCount(defaultChannel?.id || null)

    return (
        <nav className="flex-1 px-3 py-4 space-y-1">
            {navigation.map((item) => {
                const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
                return (
                    <Link
                        key={item.name}
                        href={item.href}
                        onClick={onClick}
                        className={cn(
                            'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all',
                            isActive
                                ? 'bg-primary text-primary-foreground'
                                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                        )}
                    >
                        <item.icon className="h-5 w-5" />
                        {item.name}
                        {/* Participant count badge */}
                        {item.showBadge && participantCount > 0 && (
                            <Badge
                                variant={isActive ? 'secondary' : 'default'}
                                className="ml-auto h-5 min-w-5 flex items-center justify-center px-1.5"
                            >
                                {participantCount}
                            </Badge>
                        )}
                    </Link>
                )
            })}
            {/* ... rest of admin navigation */}
        </nav>
    )
}
```

#### 3.2 Create ChitChat Page

Create `app/chitchat/page.tsx`:

```typescript
'use client'

import { useQuery } from '@tanstack/react-query'
import { useVoiceChannel } from '@/lib/voice/voice-channel-context'
import { useVoiceParticipants } from '@/hooks/use-voice-participants'
import { voiceChannelService } from '@/lib/services/voice-channels'
import { VoiceChannelPanel } from '@/components/voice/voice-channel-panel'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Headphones, Mic, Video, Users, Loader2, Monitor } from 'lucide-react'

export default function ChitChatPage() {
  const { isConnected, isConnecting, joinChannel } = useVoiceChannel()

  // Get default channel
  const { data: defaultChannel, isLoading: isLoadingChannel } = useQuery({
    queryKey: ['voice-channel', 'default'],
    queryFn: () => voiceChannelService.getDefaultChannel(),
  })

  // Get participants
  const { participants } = useVoiceParticipants(defaultChannel?.id || null)

  if (isLoadingChannel) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!defaultChannel) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground">No voice channel available</p>
      </div>
    )
  }

  // If connected, show the voice panel
  if (isConnected || isConnecting) {
    return <VoiceChannelPanel className="h-full" />
  }

  // Otherwise show the join screen
  return (
    <div className="flex flex-col items-center justify-center h-full p-6">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
            <Headphones className="h-8 w-8 text-primary" />
          </div>
          <CardTitle className="text-2xl">{defaultChannel.name}</CardTitle>
          <CardDescription>{defaultChannel.description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Participants preview */}
          {participants.length > 0 ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Currently in channel</span>
                <Badge variant="secondary" className="gap-1">
                  <Users className="h-3 w-3" />
                  {participants.length}
                </Badge>
              </div>
              <div className="flex flex-wrap gap-2">
                {participants.slice(0, 6).map((p) => (
                  <div
                    key={p.user_id}
                    className="flex items-center gap-2 px-2 py-1 bg-muted rounded-full"
                  >
                    <Avatar className="h-6 w-6">
                      <AvatarImage src={p.user.avatar_url || undefined} />
                      <AvatarFallback className="text-xs">
                        {p.user.name?.charAt(0) || 'U'}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-sm">{p.user.name}</span>
                    {!p.is_muted && (
                      <Mic className="h-3 w-3 text-green-500" />
                    )}
                  </div>
                ))}
                {participants.length > 6 && (
                  <div className="flex items-center px-2 py-1 bg-muted rounded-full">
                    <span className="text-sm text-muted-foreground">
                      +{participants.length - 6} more
                    </span>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="text-center py-4 text-muted-foreground">
              <p>No one is here yet. Be the first to join!</p>
            </div>
          )}

          {/* Join button */}
          <Button
            className="w-full gap-2"
            size="lg"
            onClick={() => joinChannel(defaultChannel)}
            disabled={isConnecting}
          >
            {isConnecting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Connecting...
              </>
            ) : (
              <>
                <Headphones className="h-4 w-4" />
                Join Voice Channel
              </>
            )}
          </Button>

          {/* Feature hints */}
          <div className="flex items-center justify-center gap-6 text-xs text-muted-foreground">
            <div className="flex items-center gap-1">
              <Mic className="h-3 w-3" />
              <span>Voice</span>
            </div>
            <div className="flex items-center gap-1">
              <Video className="h-3 w-3" />
              <span>Video</span>
            </div>
            <div className="flex items-center gap-1">
              <Monitor className="h-3 w-3" />
              <span>Screen Share</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
```

#### 3.3 Add Provider to Layout

Update your root layout or app providers to include VoiceChannelProvider:

```typescript
// In app/layout.tsx or components/providers/index.tsx
import { VoiceChannelProvider } from '@/lib/voice/voice-channel-context'

// Wrap the app with VoiceChannelProvider (inside QueryProvider and AuthProvider)
<QueryProvider>
  <AuthProvider>
    <VoiceChannelProvider>
      {children}
    </VoiceChannelProvider>
  </AuthProvider>
</QueryProvider>
```

---

### Phase 4: Real-time Participant Sync

#### 4.1 Cleanup on Page Unload

Add API route for cleanup: `app/api/voice/leave/route.ts`:

```typescript
import { createClient } from '@/lib/supabase/server'
import { NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const channelId = searchParams.get('channelId')
  const userId = searchParams.get('userId')

  if (!channelId || !userId) {
    return new Response('Missing parameters', { status: 400 })
  }

  const supabase = await createClient()

  await supabase
    .from('voice_channel_participants')
    .delete()
    .eq('channel_id', channelId)
    .eq('user_id', userId)

  return new Response('OK')
}
```

Add to VoiceChannelContext (already included in Phase 2 code):
```typescript
// Handle page unload/close
useEffect(() => {
  const handleBeforeUnload = () => {
    if (currentChannel && effectiveUser) {
      navigator.sendBeacon(
        `/api/voice/leave?channelId=${currentChannel.id}&userId=${effectiveUser.id}`
      )
    }
  }

  window.addEventListener('beforeunload', handleBeforeUnload)
  return () => window.removeEventListener('beforeunload', handleBeforeUnload)
}, [currentChannel, effectiveUser])
```

---

### Phase 5: Polish & Mobile

Mobile optimizations are built into the components above. Additional considerations:

1. **Full-screen mode on mobile** - The VoiceChannelPanel takes full height
2. **Large touch targets** - Control buttons are 48px (h-12 w-12)
3. **Responsive grid** - ParticipantGrid adjusts columns based on count

---

## 7. Component Specifications

### Component Tree

```
app/layout.tsx
└── VoiceChannelProvider
    └── app/chitchat/page.tsx
        ├── VoiceChannelPanel (when connected)
        │   ├── Header (channel name, leave button)
        │   ├── DailyProvider (wraps Daily.co SDK)
        │   │   ├── ParticipantGrid
        │   │   │   └── ParticipantTile (for each participant)
        │   │   │       ├── DailyVideo / Avatar
        │   │   │       ├── DailyAudio
        │   │   │       └── StatusIcons (mic, video, screen)
        │   │   └── VoiceControls
        │   │       ├── MuteToggle
        │   │       ├── VideoToggle
        │   │       ├── ScreenShareToggle
        │   │       ├── DeviceSettingsDialog
        │   │       └── LeaveButton
        │   └── ConnectionStatus
        │
        └── JoinScreen (when not connected)
            ├── ChannelInfo
            ├── ParticipantPreview
            └── JoinButton

components/layout/sidebar.tsx
└── NavItems
    └── ChitChat Link with Badge
        └── useVoiceParticipantCount
```

---

## 8. Testing Plan

### Manual Testing Checklist

#### Connection Flow
- [ ] Click "Join Voice Channel" connects successfully
- [ ] Status shows "Connecting" then "Connected"
- [ ] User appears in participant list
- [ ] Other users see you join in real-time
- [ ] Click "Leave" disconnects properly
- [ ] User removed from participant list

#### Audio
- [ ] Microphone enabled by default on join
- [ ] Toggle mute shows visual indicator
- [ ] Other participants can hear you when unmuted
- [ ] Mute icon shows for muted participants
- [ ] Speaking indicator activates when talking

#### Video
- [ ] Toggle camera shows video feed
- [ ] Video appears in your tile
- [ ] Other participants see your video
- [ ] Camera off shows avatar instead

#### Screen Share
- [ ] Start screen share prompts for screen selection
- [ ] Screen share visible to other participants
- [ ] Stop screen share returns to normal

#### Navigation
- [ ] Sidebar shows ChitChat with participant count badge
- [ ] Badge updates in real-time as users join/leave
- [ ] Click ChitChat navigates to `/chitchat`

### Browser Compatibility

| Browser | Desktop | Mobile |
|---------|---------|--------|
| Chrome | ✅ Test | ✅ Test (Android) |
| Firefox | ✅ Test | ⚠️ Limited |
| Safari | ✅ Test | ✅ Test (iOS) |
| Edge | ✅ Test | ✅ Test |

---

## 9. Cost Analysis

### Daily.co Pricing

| Tier | Included | Rate |
|------|----------|------|
| Free | **10,000 min/month** | $0 |
| Pay-as-you-go | Beyond free tier | **$0.004/min** |

### Usage Scenarios

| Scenario | Monthly Minutes | Daily.co Cost |
|----------|-----------------|---------------|
| Casual (5 users × 30 min × 3/week × 4 weeks) | 1,800 | **$0** |
| Moderate (10 users × 60 min × 5/week × 4 weeks) | 12,000 | **$8** |
| Heavy (20 users × 120 min × 22 days) | 105,600 | **$382** |

### Cost Optimization

1. **Encourage audio-only** - Video uses more bandwidth
2. **Implement idle timeout** - Auto-disconnect inactive users
3. **Monitor usage** - Daily dashboard shows real-time stats

---

## Summary

This implementation plan provides a complete roadmap for adding Discord-like voice/video functionality to TaskFlow using **Daily.co**:

| Aspect | Details |
|--------|---------|
| **Platform** | Daily.co (managed WebRTC) |
| **Free Tier** | 10,000 minutes/month |
| **Cost at Scale** | $0.004/minute (5x cheaper than LiveKit) |
| **SDK** | `@daily-co/daily-react` |
| **Features** | Voice, Video, Screen Share |
| **Database** | Supabase for participant tracking |
| **Real-time** | Supabase Realtime for presence |

### Implementation Phases

1. **Phase 1**: API routes for room/token, database schema, service layer
2. **Phase 2**: Voice context, Daily SDK integration, UI components
3. **Phase 3**: Navigation integration, ChitChat page
4. **Phase 4**: Real-time sync, cleanup handling
5. **Phase 5**: Device settings, mobile polish

### Key Files to Create

| Category | Files |
|----------|-------|
| **API** | `app/api/daily/room/route.ts`, `app/api/daily/token/route.ts` |
| **Components** | `components/voice/*.tsx` (7 files) |
| **Hooks** | `hooks/use-voice-*.ts` (2 files) |
| **Context** | `lib/voice/voice-channel-context.tsx` |
| **Services** | `lib/services/voice-channels.ts` |
| **Database** | `supabase/migrations/20250127000000_voice_channels.sql` |

### Key Files to Modify

| File | Changes |
|------|---------|
| `components/layout/sidebar.tsx` | Add ChitChat nav item with badge |
| `lib/types.ts` | Add voice channel types |
| `app/layout.tsx` | Add VoiceChannelProvider |
