# tool() API — OpenAI Agents JS SDK

Source: `node_modules/.pnpm/@openai+agents-core/dist/tool.d.ts`
SDK version: `@openai/agents@0.4.15`

---

## Full Options Shape

```typescript
// The common path (strict: true or omitted)
type StrictToolOptions<TParameters, Context> = {
  name?: string                    // optional — falls back to execute.name
  description: string              // required
  parameters: TParameters          // Zod schema | JSON schema | undefined
  strict?: true
  deferLoading?: boolean
  execute: ToolExecuteFunction<TParameters, Context>  // required
  errorFunction?: ToolErrorFunction | null
  needsApproval?: boolean | ToolApprovalFunction<TParameters>
  isEnabled?: ToolEnabledOption<Context>
  timeoutMs?: number
  timeoutBehavior?: 'error_as_result' | 'raise_exception'
  timeoutErrorFunction?: (context: RunContext<Context>, error: ToolTimeoutError) => Promise<string> | string
  inputGuardrails?: ToolInputGuardrailDefinition<Context>[]
  outputGuardrails?: ToolOutputGuardrailDefinition<Context>[]
}
```

---

## execute() Signature

```typescript
type ToolExecuteFunction<TParameters, Context> = (
  input: ToolExecuteArgument<TParameters>,  // Zod-inferred type
  context?: RunContext<Context>,             // optional — current run context
  details?: ToolCallDetails,                // optional — signal, toolCall, resumeState
) => Promise<unknown> | unknown
```

### ToolCallDetails

```typescript
export type ToolCallDetails = {
  toolCall?: protocol.FunctionCallItem
  resumeState?: string
  signal?: AbortSignal    // ← abort this when the session closes
}
```

**Source location:** `packages/agents-core/src/tool.ts` (not re-exported from public index — use inline `{ signal?: AbortSignal }`)

---

## errorFunction

```typescript
type ToolErrorFunction = (
  context: RunContext,       // NOT RunContext<YourContext> — plain RunContext
  error: Error | unknown,
) => Promise<string> | string
```

The string returned is sent back to the model as the tool result — it hears it verbally.

---

## Timeout Behavior

| `timeoutBehavior` | What happens |
|---|---|
| `'error_as_result'` (default) | Returns `"Tool '<name>' timed out after <N>ms."` to model |
| `'raise_exception'` | Throws `ToolTimeoutError`, caught as run exception |

`timeoutErrorFunction` overrides the default timeout message string when `error_as_result` is set.

**Recommended for voice:** `timeoutMs: 8000`, `timeoutBehavior: 'error_as_result'` so the model can verbally tell the user something went wrong.

---

## AbortSignal with Supabase

`details.signal` is an `AbortSignal`. Pass it to Supabase via `.abortSignal()`.

**CRITICAL:** `.abortSignal()` must be chained **before** `.single()` — it is a builder method, not a Promise method.

```typescript
// ✅ Correct
const { data } = await supabase
  .from('users')
  .select('name')
  .eq('id', id)
  .abortSignal(signal)   // ← before .single()
  .single()

// ❌ Wrong — TypeScript error, .single() returns a Promise not a builder
const { data } = await supabase
  .from('users')
  .select('name')
  .eq('id', id)
  .single()
  .abortSignal(signal)
```

Supabase version in this project: `@supabase/supabase-js@2.101.1`
`.abortSignal()` is available on `PostgrestBuilder` (confirmed in `@supabase/postgrest-js@2.101.1`).

---

## Context Threading

To make your app context available in tools:

```typescript
// 1. Pass context to RealtimeSession constructor
const session = new RealtimeSession(agent, {
  model,
  context: { userId, userName },  // your AgentContext
})

// 2. In execute(), second param is RunContext wrapping RealtimeContextData<AgentContext>
// RealtimeContextData<T> = T & { history: RealtimeItem[] }
// So context?.context is your AgentContext
execute: async (input, runContext, details) => {
  const myContext = runContext?.context  // type: RealtimeContextData<AgentContext>
  const userId = myContext?.userId       // your field
  const history = myContext?.history     // built-in: RealtimeItem[]
}
```
