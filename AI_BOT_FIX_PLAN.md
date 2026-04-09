# AI Bot Fix Plan

Senior GenAI review cross-referenced against the official OpenAI Agents JS SDK docs
(`github.com/openai/openai-agents-js`). Nine confirmed issues. Organized by layer
(backend → SDK usage → tools → database → features), roughly in dependency order so
fixes don't step on each other.

---

## Issue Index

| # | Layer | Issue | Severity |
|---|-------|-------|----------|
| 1 | Backend | Bot join route uses wrong token endpoint | Broken |
| 2 | Backend | `ai_sessions` INSERT blocked by RLS | Broken |
| 3 | SDK | `model` and `voice` passed to wrong places | Wrong pattern |
| 4 | SDK | `voice` from admin config never reaches `RealtimeAgent` | Silent ignore |
| 5 | SDK | No `session.mute()` control exposed to UI | UX gap |
| 6 | Tools | Tool `execute` ignores SDK-provided `context` / `details` | Reliability |
| 7 | Tools | No `timeoutMs` — hanging Supabase calls stall voice session | Reliability |
| 8 | Features | Trigger phrases stored in DB but never injected into instructions | Dead feature |
| 9 | Features | `history_updated` never captured — `meeting_minutes` table is dead schema | Dead code |

---

## Fix 1 — Bot Join Route: Wrong Token Endpoint

**File:** `apps/web/app/api/ai/bot/join/route.ts`

### What's wrong

The route calls `POST /v1/realtime/sessions`. The correct endpoint for a
browser-facing ephemeral client token is `POST /v1/realtime/client_secrets`.
These are two different endpoints with different request body shapes and different
response shapes.

- `/v1/realtime/sessions` → returns a `client_secret` object nested inside the
  response, intended for server-side session management.
- `/v1/realtime/client_secrets` → returns a top-level `value` string starting with
  `ek_`, intended to be passed directly to `session.connect({ apiKey })` in the
  browser.

The direct chat route (`/api/ai/chat/token`) already uses the correct endpoint.
The bot join route needs to match it.

### Approach

1. Change the fetch URL in the bot join route to `/v1/realtime/client_secrets`.
2. Align the request body to `{ session: { type: "realtime", model } }` — same
   shape the direct chat route already sends.
3. Extract the token from `tokenData.value` (not `tokenData.client_secret`).
4. Return it as `clientSecret: tokenData.value` (a plain string) so the hook
   receives a consistent shape.
5. Remove the dual-shape handling in `use-ai-bot-session.ts` that guards against
   both object and string — once the API always returns a string, that defensive
   code is dead weight.

---

## Fix 2 — RLS: `ai_sessions` INSERT Blocked for Authenticated Users

**Files:** `supabase/migrations/` (new migration), `apps/web/app/api/ai/bot/join/route.ts`,
`apps/web/app/api/ai/bot/leave/route.ts`

### What's wrong

The existing RLS policies on `ai_sessions` grant INSERT/UPDATE only to
`service_role`. The bot join and leave routes use the authenticated user's Supabase
client (not the admin/service-role client). Every bot activation silently fails at
the DB insert step even though the OpenAI token was already consumed.

### Approach

Two valid paths — pick the simpler one for your architecture:

**Option A (preferred):** Switch the INSERT and UPDATE calls in the bot join/leave
routes to use the admin client (`lib/supabase/admin.ts`). No migration needed.
The admin client bypasses RLS entirely. Keep the auth check before the admin
client is used so it's still gated to authenticated users.

**Option B:** Write a new migration that adds an authenticated-user INSERT policy
on `ai_sessions` scoped to the `host_user_id` matching `auth.uid()`. Also add an
UPDATE policy so the host can end their own session. This keeps the user client
throughout but requires a migration.

Option A is less risky — no schema change, no RLS policy to audit.

---

## Fix 3 — SDK: `model` and `voice` Passed to Wrong Places

**Files:** `apps/web/components/voice/ai-voice-bot.tsx`,
`apps/web/components/ai-chat/ai-direct-voice-chat.tsx`

### What's wrong

Per the SDK docs, the model belongs in the `RealtimeSession` constructor options,
not in `session.connect()`. The `connect()` call accepts `model` as an optional
override but the canonical pattern — and the one shown in all official examples —
is:

```
new RealtimeSession(agent, { model: '...' })
session.connect({ apiKey: '...' })
```

Passing model to `connect()` works today due to the optional override but it
couples connection logic with configuration that should be set at session
construction. More critically, the `voice` option belongs on `RealtimeAgent`
config, not on the token request body.

### Approach

1. Move `model` from `session.connect({ apiKey, model })` to
   `new RealtimeSession(agent, { model })` in both components.
2. Move `voice` from the token request body into `new RealtimeAgent({ ..., voice })`.
   The voice value should be passed as a prop from the parent that fetched the
   bot config (it's already available in the hook response).
3. `session.connect()` should then only receive `{ apiKey: clientSecret }`.

---

## Fix 4 — `voice` from Admin Config Never Reaches `RealtimeAgent`

**Files:** `apps/web/app/api/ai/bot/join/route.ts`,
`apps/web/hooks/use-ai-bot-session.ts`,
`apps/web/components/voice/ai-voice-bot.tsx`

### What's wrong

The admin-configured voice (`botConfig.voice`) is sent to the token endpoint
request body. Once Fix 1 switches to `/v1/realtime/client_secrets`, it needs to be
in the `session` object inside that body — but it also needs to be set on
`RealtimeAgent` locally (per Fix 3). Currently the component never receives the
voice value at all.

### Approach

1. The bot join API response should include `voice` alongside `botName`, `model`,
   and `clientSecret`.
2. `use-ai-bot-session.ts` should store `voice` in state alongside `botName` and
   `model`, and expose it from the hook.
3. Pass `voice` as a prop to `AIVoiceBot` and use it in `new RealtimeAgent({ voice })`.
4. Also include `voice` in the `/v1/realtime/client_secrets` request body inside
   the `session` object so the server-side session and the local agent agree on
   the same voice.

---

## Fix 5 — No `session.mute()` Control Exposed to UI

**Files:** `apps/web/components/voice/ai-voice-bot.tsx`,
`apps/web/components/voice/voice-controls.tsx` (or wherever the bot tile renders)

### What's wrong

The SDK exposes `session.mute(true/false)` but the component holds the session
in a ref and never exposes mute to the parent. Users have no way to silence the
bot mid-response. The bot tile (`ai-bot-tile.tsx`) shows a static mic icon but
it's not wired to anything.

### Approach

1. Expose a `mute` / `unmute` method from `AIVoiceBot` via a forwarded ref or an
   `onSessionReady(session)` callback prop — whichever fits the existing component
   pattern.
2. In the parent (voice channel panel or controls), wire the bot tile's mic button
   to call mute/unmute.
3. Track muted state locally and reflect it in the bot tile's visual state.

---

## Fix 6 — Tool `execute` Ignores SDK Context and Details

**File:** `apps/web/lib/ai/agent-tools.ts`

### What's wrong

The SDK's `tool()` `execute` function receives `(args, context, details)`. The
`context` is a `RunContext` containing the current run state. The `details` object
includes `details.signal` — an AbortSignal that fires when the session is
interrupted or closed. Your tools ignore both, which means:

- Tools cannot be cancelled mid-execution if the user ends the session.
- You cannot pass per-invocation data (like the authenticated Supabase client)
  through context, so you're forced to use a module-level client singleton instead.
- Tool errors have no structured path — any thrown error bubbles up to the SDK's
  default error formatter.

There's also a secondary bug: `get_users` returns the bot user
(`00000000-0000-0000-0000-000000000001`) in its results, so the AI can attempt to
"send a message to Bot", which will fail.

### Approach

1. Refactor `AgentContext` to hold a Supabase client instance (created fresh per
   session with the authenticated user's credentials) rather than relying on the
   module-level singleton.
2. Pass the context object into `RealtimeSession` constructor options as `context`
   (the SDK threads it through to every tool call as the second argument).
3. Update `execute` signatures to `async (args, runContext, details)` and read the
   Supabase client from `runContext.context` instead of the module-level import.
4. Use `details.signal` (AbortSignal) in any async Supabase call so they abort
   cleanly when the session closes.
5. Filter the bot user out of `get_users` results with a `.neq()` clause.
6. Add an `errorFunction` to both tools that returns a clean natural-language
   string so the model can relay the failure to the user verbally instead of
   going silent.

---

## Fix 7 — No `timeoutMs` on Tools

**File:** `apps/web/lib/ai/agent-tools.ts`

### What's wrong

Neither `get_users` nor `send_message` has a `timeoutMs`. If Supabase is slow or
unreachable, the tool call hangs indefinitely. The voice session stays open but
the model is waiting for a tool result that never arrives — the user hears silence
with no indication of what's happening.

### Approach

1. Add `timeoutMs` to both tools. A reasonable ceiling is 8–10 seconds for a
   voice UX — longer than that and the conversation feels broken regardless.
2. Set `timeoutBehavior: 'error_as_result'` (the SDK default) so the model
   receives a readable timeout message and can verbally tell the user something
   went wrong.
3. Optionally add a `timeoutErrorFunction` that returns a voice-friendly string
   like `"I couldn't reach the server in time. Please try again."`.

---

## Fix 8 — Trigger Phrases Never Injected Into Agent Instructions

**Files:** `apps/web/app/api/ai/bot/join/route.ts`,
`apps/web/hooks/use-ai-bot-session.ts`,
`apps/web/components/voice/ai-voice-bot.tsx`

### What's wrong

`trigger_phrases` is a configurable array stored in `ai_bot_config` and shown in
the admin settings UI. The UI works fine. But the agent instructions hardcode
`"${botName}"` and `"Hey ${botName}"` regardless of what the admin configured. The
stored phrases have zero runtime effect.

Note: the OpenAI Realtime API has no native wake-word detection — this must be
entirely prompt-driven. That's fine, but the prompt has to actually use the
configured phrases.

### Approach

1. Include `trigger_phrases` in the bot join API response alongside `botName`,
   `model`, and `voice`.
2. Add `triggerPhrases: string[]` to the hook's state and expose it.
3. Pass `triggerPhrases` as a prop to `AIVoiceBot` and `AIDirectVoiceChat`.
4. Build the instructions string dynamically using the phrases array — join them
   naturally (e.g., `"Respond only when addressed as: Bot, Hey Bot, or TaskBot"`).
5. Apply the same approach to the direct chat component so both surfaces respect
   the config.

---

## Fix 9 — `history_updated` Not Captured; `meeting_minutes` Table Is Dead

**Files:** `apps/web/components/voice/ai-voice-bot.tsx`,
`apps/web/app/api/ai/bot/leave/route.ts`,
`supabase/migrations/` (optional new migration to add transcript column if needed)

### What's wrong

The SDK emits `history_updated` events throughout the session, each carrying the
full conversation transcript as a `RealtimeItem[]` array. This is the correct hook
to accumulate a transcript. Your `ai_sessions` table has a `transcript JSONB`
column and `meeting_minutes` has `raw_transcript`, `summary`, `discussion_points`,
`action_items`, and `decisions` columns — all empty because nothing writes to them.

The meeting summarization feature is entirely planned but unimplemented.

### Approach

**Phase A — Transcript capture (do this now):**

1. In `AIVoiceBot`, listen to `session.on('history_updated', (history) => ...)` and
   keep a local ref with the latest history snapshot.
2. When the bot deactivates (either via the leave button or the component unmounting),
   send the accumulated history to the leave API route as a JSON payload.
3. The leave route should write the transcript to `ai_sessions.transcript` using
   the admin client (since the column exists and just needs to be populated).

**Phase B — Meeting summarization (separate task, do after Phase A):**

1. After the session ends and the transcript is saved, trigger a separate
   non-realtime call to a text model (e.g., `gpt-4o`) with a summarization prompt.
2. Parse the summary into the structured fields (`summary`, `discussion_points`,
   `action_items`, `decisions`) and write them to `meeting_minutes`.
3. This can be done as a Next.js API route called from the leave flow, or as a
   Supabase Edge Function triggered by the `ai_sessions` status changing to
   `'ended'`.

Phase B is optional until Phase A is working and transcript quality is confirmed.

---

## Implementation Order

Dependencies flow in this sequence — do not reorder steps 1–4:

```
Fix 2 (RLS)           ← unblocks all DB writes
Fix 1 (endpoint)      ← unblocks token flow
Fix 3 + 4 (SDK)       ← depends on correct token shape from Fix 1
Fix 6 + 7 (tools)     ← depends on context pattern from Fix 3/4
Fix 5 (mute)          ← depends on session being wired correctly
Fix 8 (phrases)       ← depends on token/API response including phrases
Fix 9 Phase A (transcript) ← depends on session lifecycle being stable
Fix 9 Phase B (summary)    ← depends on Phase A
```

---

## Files Touched Summary

| File | Fixes |
|------|-------|
| `apps/web/app/api/ai/bot/join/route.ts` | 1, 2, 4, 8 |
| `apps/web/app/api/ai/bot/leave/route.ts` | 2, 9A |
| `apps/web/hooks/use-ai-bot-session.ts` | 1, 4, 8 |
| `apps/web/lib/ai/agent-tools.ts` | 6, 7 |
| `apps/web/components/voice/ai-voice-bot.tsx` | 3, 4, 5, 8, 9A |
| `apps/web/components/ai-chat/ai-direct-voice-chat.tsx` | 3, 8 |
| `apps/web/components/voice/voice-controls.tsx` | 5 |
| `apps/web/components/voice/ai-bot-tile.tsx` | 5 |
| `supabase/migrations/` (new migration) | 2 (if Option B chosen) |

---

## What Is NOT Being Fixed Here

- **Host-coupled architecture** — the bot only hears the activating user's
  microphone, not all participants. Fixing this properly requires running the
  Realtime session server-side with WebSocket transport and routing Daily.co
  audio tracks to it. That is a significant architectural change and a separate
  project.
- **Bot user level** — the bot user is inserted with `level = 1` (highest
  authority). Should be either the lowest level number or a dedicated `is_bot`
  column. Left out because it requires an RLS policy audit to determine blast
  radius.
- **`meeting_minutes` Phase B summarization** — scoped out until transcript
  capture (Fix 9A) is confirmed working.