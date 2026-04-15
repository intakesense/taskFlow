# RealtimeSession API — OpenAI Agents JS SDK

Source: `node_modules/.pnpm/@openai+agents@0.4.15/node_modules/@openai/agents/dist/index.d.ts`
SDK version: `@openai/agents@0.4.15`

---

## Constructor

```typescript
new RealtimeSession(
  initialAgent: RealtimeAgent<TBaseContext>,
  options?: Partial<RealtimeSessionOptions<TBaseContext>>
)
```

### RealtimeSessionOptions

```typescript
type RealtimeSessionOptions<TContext = unknown> = {
  apiKey?: ApiKey
  transport?: 'webrtc' | 'websocket' | RealtimeTransportLayer
  model?: OpenAIRealtimeModels | (string & {})   // ← SET MODEL HERE
  context?: TContext                              // ← SET YOUR APP CONTEXT HERE
  outputGuardrails?: RealtimeOutputGuardrail[]
  outputGuardrailSettings?: RealtimeOutputGuardrailSettings
  config?: Partial<RealtimeSessionConfig>
  historyStoreAudio?: boolean
  tracingDisabled?: boolean
  groupId?: string
  traceMetadata?: Record<string, any>
  workflowName?: string
  automaticallyTriggerResponseForMcpToolCalls?: boolean
  toolErrorFormatter?: ToolErrorFormatter<RealtimeContextData<TContext>>
}
```

---

## connect()

```typescript
async connect(options: RealtimeSessionConnectOptions): Promise<void>

type RealtimeSessionConnectOptions = {
  apiKey: string | (() => string | Promise<string>)  // required: ephemeral key "ek_..."
  model?: OpenAIRealtimeModels | (string & {})        // ← IGNORED — see note below
  url?: string
  callId?: string
}
```

### CRITICAL: model in connect() is IGNORED

SDK source (`realtimeSession.ts`) confirmed:

```typescript
await this.#transport.connect({
  apiKey: options.apiKey ?? this.options.apiKey,  // connect-time apiKey WINS
  model: this.options.model,                       // always uses CONSTRUCTOR model
  url: options.url,
  callId: options.callId,
  ...
})
```

**The transport always uses `this.options.model` (set in constructor), never `connect().model`.**

`apiKey` from `connect()` does override the constructor value — that's intentional since you get the ephemeral key after construction.

**Correct pattern:**
```typescript
const session = new RealtimeSession(agent, { model: 'gpt-4o-realtime-preview' })
await session.connect({ apiKey: ephemeralKey })  // model NOT passed here
```

---

## mute()

```typescript
mute(muted: boolean): void
```

Synchronous. Delegates to `this.#transport.mute(muted)`. Works on WebRTC transport (disables mic input).

Usage:
```typescript
session.mute(true)   // silence mic
session.mute(false)  // restore mic
```

---

## Events

```typescript
session.on('history_updated', (history: RealtimeItem[]) => void)
session.on('history_added',   (item: RealtimeItem) => void)
session.on('audio_start',     (context, agent) => void)
session.on('audio_stopped',   (context, agent) => void)
session.on('audio_interrupted', (context, agent) => void)
session.on('error',           (error: RealtimeSessionError) => void)
session.on('agent_start',     (context, agent, turnInput?) => void)
session.on('agent_end',       (context, agent, output) => void)
session.on('agent_handoff',   (context, fromAgent, toAgent) => void)
session.on('agent_tool_start', (context, agent, tool, details) => void)
session.on('agent_tool_end',   (context, agent, tool, result, details) => void)
session.on('transport_event', (event: TransportEvent) => void)
session.on('guardrail_tripped', (context, agent, error, details) => void)
```

### history_updated payload

`history: RealtimeItem[]` — the **full conversation history** snapshot on every update.
Use a ref to always have the latest: `historyRef.current = history`.

### RealtimeItem

```typescript
// exported from @openai/agents/realtime
type RealtimeItem = RealtimeMessageItem | RealtimeToolCallItem | RealtimeBaseItem
```

Serializable to JSON — safe to send to the leave API route and store in `ai_sessions.transcript` (JSONB column).

---

## Token Endpoint

For `connect({ apiKey })` the key must come from `/v1/realtime/client_secrets` (not `/v1/realtime/sessions`):

```typescript
// Server-side (API route)
const response = await fetch('https://api.openai.com/v1/realtime/client_secrets', {
  method: 'POST',
  headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
  body: JSON.stringify({
    session: { type: 'realtime', model }
  }),
})
const { value } = await response.json()  // value starts with "ek_"
// Pass value as clientSecret to the client
```

`/v1/realtime/sessions` is a different endpoint for server-side session management — its response shape is different and should NOT be used for ephemeral client keys.
