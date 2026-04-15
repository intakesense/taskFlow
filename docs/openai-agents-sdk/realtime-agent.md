# RealtimeAgent API — OpenAI Agents JS SDK

Source: `node_modules/.pnpm/@openai+agents@0.4.15/node_modules/@openai/agents-realtime/dist/realtimeAgent.d.ts`
SDK version: `@openai/agents@0.4.15`

---

## Constructor

```typescript
new RealtimeAgent(config: RealtimeAgentConfiguration<TContext>)
```

### RealtimeAgentConfiguration

```typescript
type RealtimeAgentConfiguration<TContext> = Partial<Omit<AgentConfiguration<...>,
  | 'model'          // ← NOT supported on RealtimeAgent
  | 'handoffs'       // ← replaced by RealtimeAgent-specific handoffs
  | 'modelSettings'  // ← NOT supported
  | 'outputType'     // ← NOT supported (always TextOutput)
  | 'toolUseBehavior'// ← NOT supported
  | 'resetToolChoice'// ← NOT supported
  | 'outputGuardrails'
  | 'inputGuardrails'
>> & {
  name: string                        // required
  handoffs?: RealtimeAgent[] | Handoff[]  // optional
  voice?: string                      // ← SET VOICE HERE
}
```

### Supported fields (inherited from AgentConfiguration)

```typescript
name: string                 // required
instructions?: string        // system prompt
tools?: Tool[]               // function tools
voice?: string               // voice ID — set on agent, not session
handoffs?: RealtimeAgent[]   // agents this agent can hand off to
```

---

## voice placement

`voice` must be set on `RealtimeAgent`, not on `RealtimeSession` or `session.connect()`.

```typescript
// ✅ Correct
const agent = new RealtimeAgent({
  name: 'Assistant',
  voice: 'alloy',       // ← here
  instructions: '...',
  tools: [...],
})

// ❌ Wrong — voice is not a field on RealtimeSessionOptions
const session = new RealtimeSession(agent, { voice: 'alloy' })

// ❌ Wrong — voice is not a field on RealtimeSessionConnectOptions
await session.connect({ apiKey, voice: 'alloy' })
```

**Limitation:** If another agent already spoke during the `RealtimeSession`, changing `voice` during a handoff will fail. Voice is effectively locked to the first agent that speaks.

---

## model placement

`model` is NOT set on `RealtimeAgent` — it's set on `RealtimeSession`:

```typescript
const session = new RealtimeSession(agent, {
  model: 'gpt-4o-realtime-preview',
})
```

All agents within a session share the same model. You cannot give individual agents different models.

---

## What RealtimeAgent does NOT support

| Feature | Why |
|---|---|
| `model` | All agents in a session use the same model (set on RealtimeSession) |
| `modelSettings` | Same reason |
| `outputType` | RealtimeAgents always output text/audio, no structured outputs |
| `toolUseBehavior` | Handled by the session |
| `inputGuardrails` | Not supported in realtime context |
| `outputGuardrails` | Available on RealtimeSession instead |
