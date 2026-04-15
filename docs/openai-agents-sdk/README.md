# OpenAI Agents JS SDK — Research & Reference

Verified against SDK version `@openai/agents@0.4.15` (installed in this project).
All findings confirmed by reading actual `.d.ts` files in `node_modules`, not just documentation.

## Package Structure

```
@openai/agents          ← umbrella package, re-exports everything
  ├── @openai/agents-core       ← tool(), RunContext, Agent, etc.
  ├── @openai/agents-openai     ← OpenAI-specific runner
  └── @openai/agents-realtime   ← RealtimeAgent, RealtimeSession, RealtimeItem
```

### Import Paths

| What you need | Import from |
|---|---|
| `tool()`, `RunContext` | `@openai/agents` |
| `RealtimeAgent`, `RealtimeSession` | `@openai/agents/realtime` |
| `RealtimeContextData`, `RealtimeItem` | `@openai/agents/realtime` |

`@openai/agents/realtime` maps to `@openai/agents-realtime` via package exports.

---

## Files

| File | Contents |
|---|---|
| [tool-api.md](tool-api.md) | `tool()` function — full options, execute signature, timeout, errorFunction |
| [realtime-session.md](realtime-session.md) | `RealtimeSession` constructor, `connect()`, `mute()`, events |
| [realtime-agent.md](realtime-agent.md) | `RealtimeAgent` constructor options |
| [architecture-flaw.md](architecture-flaw.md) | The host-coupled audio routing flaw and the correct server-side architecture |
