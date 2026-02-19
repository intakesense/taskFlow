# AI Voice Features Implementation

This document describes the AI voice features for TaskFlow using OpenAI Agents SDK.

## Overview

TaskFlow has two AI voice features:

1. **Meeting Bot** - AI assistant that joins Daily.co voice channels
2. **Direct Chat** - 1-on-1 voice conversation via floating button (like Meta AI in WhatsApp)

Both use the [OpenAI Agents SDK](https://openai.github.io/openai-agents-js/) with WebRTC transport.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    User's Browser                               │
│                                                                  │
│  ┌──────────────────┐         ┌──────────────────────────────┐  │
│  │  User's          │         │  RealtimeSession (WebRTC)    │  │
│  │  Microphone      │────────►│  - Auto captures mic         │  │
│  │                  │         │  - Auto plays AI responses   │  │
│  │  Browser         │◄────────│                              │  │
│  │  Speakers        │         │  (SDK handles everything)    │  │
│  └──────────────────┘         └──────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                                        │
                                        ▼
┌─────────────────────────────────────────────────────────────────┐
│           Next.js API Routes (Vercel Serverless)                │
│                                                                  │
│  POST /api/ai/chat/token     → Ephemeral token for direct chat │
│  POST /api/ai/bot/join       → Activate meeting bot            │
│  GET  /api/ai/bot/join       → Get bot status                  │
│  POST /api/ai/bot/leave      → Deactivate meeting bot          │
└─────────────────────────────────────────────────────────────────┘
```

## Technology Stack

| Component | Technology |
|-----------|------------|
| AI Framework | `@openai/agents/realtime` |
| Voice Model | `OPENAI_REALTIME_MODEL` env var |
| Connection | WebRTC (browser-direct, SDK default) |
| Token Generation | Next.js API Route |
| Video Platform | Daily.co (for meeting bot) |

## Implementation

### SDK Usage (per official docs)

Based on [OpenAI Agents SDK Quickstart](https://openai.github.io/openai-agents-js/guides/voice-agents/quickstart/):

```typescript
import { RealtimeAgent, RealtimeSession } from '@openai/agents/realtime'

// 1. Create agent with instructions
const agent = new RealtimeAgent({
  name: 'Assistant',
  instructions: 'You are a helpful assistant.',
})

// 2. Create session (WebRTC is default transport)
const session = new RealtimeSession(agent)

// 3. Connect with ephemeral token
await session.connect({
  apiKey: clientSecret,  // Ephemeral token from server
  model: 'gpt-4o-realtime-preview',
})

// WebRTC automatically handles:
// - Microphone capture
// - Audio playback
// - Voice activity detection
```

### Direct Chat Component

```typescript
// components/ai-chat/ai-direct-voice-chat.tsx
export function AIDirectVoiceChat({ clientSecret, model, onStateChange }) {
  const sessionRef = useRef<RealtimeSession | null>(null)

  const connect = useCallback(async () => {
    const agent = new RealtimeAgent({
      name: 'Assistant',
      instructions: `You are a helpful AI assistant...`,
    })

    const session = new RealtimeSession(agent)
    sessionRef.current = session

    // Track speaking state for UI
    session.on('audio_start', () => onStateChange?.('speaking'))
    session.on('audio_stopped', () => onStateChange?.('listening'))
    session.on('error', (error) => toast.error('AI connection error'))

    await session.connect({ apiKey: clientSecret, model })
  }, [clientSecret, model])

  return null  // No UI - audio handled by browser
}
```

### Meeting Bot Component

```typescript
// components/voice/ai-voice-bot.tsx
export function AIVoiceBot({ clientSecret, botName, model }) {
  const connect = useCallback(async () => {
    const agent = new RealtimeAgent({
      name: botName,
      instructions: `You are ${botName}, a helpful AI assistant in a voice meeting.
        - Only respond when directly addressed
        - Keep responses brief (1-2 sentences)
        - Stay COMPLETELY SILENT when not addressed`,
    })

    const session = new RealtimeSession(agent)

    session.on('audio_start', () => console.log('AI speaking'))
    session.on('audio_stopped', () => console.log('AI stopped'))
    session.on('error', (error) => toast.error('AI error'))

    await session.connect({ apiKey: clientSecret, model })
  }, [clientSecret, botName, model])

  return null
}
```

## Agent Tools

Both AI bots support function tools for performing actions on behalf of the user.

### Tool Definition (per SDK docs)

```typescript
import { tool } from '@openai/agents'
import { z } from 'zod'

const getUsersTool = tool({
  name: 'get_users',
  description: 'Get all users who can receive messages',
  parameters: z.object({}),
  execute: async () => {
    // Fetch users from database
    return { users: [...] }
  },
})

const sendMessageTool = tool({
  name: 'send_message',
  description: 'Send a message to a user',
  parameters: z.object({
    recipientId: z.string(),
    message: z.string(),
  }),
  execute: async ({ recipientId, message }) => {
    // Send message via Supabase
    return { success: true }
  },
})
```

### Using Tools with RealtimeAgent

```typescript
const agent = new RealtimeAgent({
  name: 'Assistant',
  instructions: 'You can send messages. Call get_users first, then send_message.',
  tools: [getUsersTool, sendMessageTool],
})
```

### Current Tools

| Tool | Purpose |
|------|---------|
| `get_users` | Discovery - fetches all users with IDs |
| `send_message` | Action - sends DM from logged-in user |

Tools are defined in `lib/ai/agent-tools.ts`.

## Features

### 1. Direct Chat (Floating Button)

- Purple floating button in bottom-right corner
- Opens full-screen modal with animated orb
- 1-on-1 voice conversation with AI
- States: connecting, listening, speaking, error

### 2. Meeting Bot

- Activated via Bot button in voice controls
- Host-based: whoever activates runs the bot
- Listens silently, responds when addressed by name
- Audio plays through host's browser to Daily.co

## API Routes

### POST /api/ai/chat/token

Generates ephemeral token for direct chat.

```typescript
// Response
{
  clientSecret: string,
  expiresAt: number,
  model: string
}
```

### POST /api/ai/bot/join

Activates meeting bot.

```typescript
// Request
{ channelId: string }

// Response
{
  success: true,
  sessionId: string,
  botName: string,
  clientSecret: string,
  model: string
}
```

## Environment Variables

```env
OPENAI_API_KEY=sk-...
OPENAI_REALTIME_MODEL=gpt-4o-realtime-preview
```

Both are validated at build time in `next.config.ts`.

## File Structure

```
lib/ai/
└── agent-tools.ts           # Tool definitions (get_users, send_message)

hooks/
├── use-ai-direct-chat.ts    # Hook for direct chat state
└── use-ai-bot-session.ts    # Hook for meeting bot activation

components/ai-chat/
├── ai-direct-voice-chat.tsx # Direct chat WebRTC component
├── ai-voice-chat-modal.tsx  # Full-screen modal with orb
├── ai-voice-chat-button.tsx # Floating button
└── index.ts                 # Barrel export

components/voice/
├── ai-voice-bot.tsx         # Meeting bot WebRTC component
├── ai-bot-tile.tsx          # Virtual participant tile
└── voice-controls.tsx       # Bot toggle button

app/api/ai/
├── chat/token/route.ts      # Direct chat token
└── bot/
    ├── join/route.ts        # Activate/status
    ├── leave/route.ts       # Deactivate
    └── config/route.ts      # Admin settings
```

## Database Schema

### ai_bot_config

```sql
CREATE TABLE ai_bot_config (
    id UUID PRIMARY KEY,
    name TEXT DEFAULT 'Bot',
    voice TEXT DEFAULT 'alloy',
    is_enabled BOOLEAN DEFAULT TRUE,
    updated_at TIMESTAMPTZ,
    updated_by UUID REFERENCES users(id)
);
```

### ai_sessions

```sql
CREATE TABLE ai_sessions (
    id UUID PRIMARY KEY,
    voice_channel_id UUID REFERENCES voice_channels(id),
    host_user_id UUID REFERENCES users(id),
    status TEXT DEFAULT 'active',
    started_at TIMESTAMPTZ DEFAULT NOW(),
    ended_at TIMESTAMPTZ
);
```

## Sources

- [OpenAI Agents SDK](https://openai.github.io/openai-agents-js/)
- [Voice Agents Quickstart](https://openai.github.io/openai-agents-js/guides/voice-agents/quickstart/)
- [Transport Layer](https://openai.github.io/openai-agents-js/guides/voice-agents/transport/)
- [RealtimeSession API](https://openai.github.io/openai-agents-js/openai/agents/realtime/classes/realtimesession/)
