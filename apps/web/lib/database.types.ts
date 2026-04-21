// Single source of truth for database types lives in @taskflow/core.
// Run `pnpm db:types` to regenerate — it writes to packages/core/src/types/database.ts
// and this file re-exports from there so web and desktop stay in sync automatically.
export type { Json, Database } from '@taskflow/core'
