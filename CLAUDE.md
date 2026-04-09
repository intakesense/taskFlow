# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

TaskFlow is a hierarchical task management system built with Next.js 16 (App Router), Supabase, and shadcn/ui. The system implements a level-based organizational hierarchy where users can assign tasks to those at the same or lower levels, with configurable visibility controls and a built-in messaging system.

## Commands

### Development
```bash
pnpm dev        # Start development server on http://localhost:3000
pnpm build      # Build for production
pnpm start      # Start production server
pnpm lint       # Run ESLint
```

### Database Management
```bash
pnpm db:push      # Push migrations to remote database
pnpm db:pull      # Pull remote schema changes
pnpm db:migration # Create new migration
pnpm db:types     # Generate TypeScript types
pnpm db:status    # Check migration status
```

**See [DATABASE_WORKFLOW.md](DATABASE_WORKFLOW.md) for complete database workflow.**

## Monorepo Structure

This is a Turborepo monorepo with shared packages:

| Package | Contents | Used By |
|---------|----------|---------|
| `@taskflow/core` | Types, schemas, database types | Web, Desktop, Mobile |
| `@taskflow/ui` | shadcn components, animations, sonner, emoji-picker | Web, Desktop, Mobile |
| `@taskflow/features` | **Shared feature components, hooks, services** | Web, Desktop |
| `@taskflow/supabase-client` | Supabase client factory | Web, Desktop, Mobile |

### @taskflow/features Package

The canonical home for all feature code. Both web and desktop consume from here. Platform-specific APIs are abstracted so components work identically in Next.js and Tauri:

```
packages/features/src/
├── providers/          # Platform abstraction (navigation, auth, services)
├── hooks/              # React Query hooks (use-tasks, use-conversations, etc.)
├── services/           # Supabase data operations (tasks, messages, notes, users)
├── utils/              # date, error, haptics, realtime-manager
└── components/
    ├── layout/         # Sidebar, BottomNav, DashboardLayout
    ├── primitives/     # NavigationLink
    ├── tasks/          # Full task UI: kanban, cards, containers, detail views
    ├── messages/       # Full messaging UI: chat, conversation list, containers
    ├── progress/       # Task progress feed and timeline
    ├── settings/       # Appearance, settings view
    ├── voice/          # ChitChat voice/video UI
    └── auth/           # Login view
```

**Key abstractions:**
- `useNavigation()` - Replaces `useRouter()` and `usePathname()`
- `NavigationLink` - Replaces `next/link`
- `useAuth()` - Unified auth interface
- `useServices()` - Access to tasks, messages, users services

**IMPORTANT:** All new feature components, hooks, and services go in `packages/features/src/`, not in `apps/web/`. The web app under `apps/web/components/` and `apps/web/hooks/` contains legacy copies — do not add to them.

### apps/web — Web-Only Code

Only code that cannot be shared belongs in `apps/web/`:

```
apps/web/
├── app/                # Next.js App Router: pages, API routes, middleware
│   ├── app/admin/      # Admin user management (Server Actions)
│   ├── app/api/        # API routes (Daily.co, AI bot, notifications, voice)
│   └── app/auth/       # Auth callback (PKCE flow)
├── lib/supabase/       # Four Supabase client patterns (server, client, middleware, admin)
├── lib/auth-context.tsx # Web AuthContext with mask-as feature
├── lib/schemas/        # Zod validation schemas (auth, task, user, message)
├── lib/theme/          # Dynamic CSS variable theming
└── components/ui/      # shadcn/ui primitives (Button, Dialog, etc.)
```

## Code Standards & Best Practices

### Forms (React Hook Form + Zod)
**REQUIRED:** All forms must use React Hook Form with Zod validation.

```typescript
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { loginSchema, type LoginFormData } from '@/lib/schemas/auth'

const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<LoginFormData>({
  resolver: zodResolver(loginSchema)
})
```

- Validation schemas located in `apps/web/lib/schemas/`:
  - `lib/schemas/auth.ts` - Login and signup schemas
  - `lib/schemas/task.ts` - Task creation/update schemas
  - `lib/schemas/user.ts` - User management schemas
  - `lib/schemas/message.ts` - Message and conversation schemas
- Never use manual `useState` for form fields
- See `apps/web/app/login/page.tsx`, `packages/features/src/components/tasks/create-task-drawer.tsx`, and `packages/features/src/components/messages/new-chat-dialog.tsx` for reference implementations

### User Feedback (Sonner)
**REQUIRED:** All user actions must show toast notifications.

```typescript
import { toast } from 'sonner'

toast.success('Task created!')
toast.error('Failed to save')
toast.loading('Processing...')
toast.promise(asyncFn(), {
  loading: 'Saving...',
  success: 'Saved!',
  error: 'Failed to save'
})
```

- Never use `console.error()` without showing user feedback
- Toast component already added to root layout
- See `apps/web/app/login/page.tsx` and `apps/web/app/page.tsx` for examples

### Date Formatting
**REQUIRED:** Use utilities from `lib/utils/date.ts` for all date operations.

```typescript
import { formatMessageTime, formatDateTime, formatRelative } from '@/lib/utils/date'

formatMessageTime(dateString)  // "2:30 PM" or "Yesterday"
formatDateTime(dateString)      // "Jan 19, 2:30 PM"
formatRelative(dateString)      // "2 hours ago"
```

- Never use inline `new Date().toLocaleString()` or similar
- Utilities handle edge cases (today, yesterday, null values)

### Data Tables (TanStack Table)
**REQUIRED:** Use the DataTable component for lists with sorting, filtering, and pagination.

```typescript
import { DataTable } from '@/components/ui/data-table'
import { ColumnDef } from '@tanstack/react-table'

const columns: ColumnDef<User>[] = [
  { accessorKey: 'name', header: 'Name' },
  { accessorKey: 'email', header: 'Email' },
]

<DataTable
  columns={columns}
  data={users}
  searchKey="name"
  searchPlaceholder="Search users..."
/>
```

- Component provides sorting, filtering, pagination, and column visibility
- Fully type-safe with TypeScript
- See [apps/web/components/ui/data-table.tsx](apps/web/components/ui/data-table.tsx) for implementation

### File Uploads (Drag & Drop)
**REQUIRED:** Use the FileUpload component for file selection with drag & drop.

```typescript
import { FileUpload, FilePreview } from '@/components/ui/file-upload'

const [files, setFiles] = useState<File[]>([])

<FileUpload
  onFilesSelected={(newFiles) => setFiles([...files, ...newFiles])}
  maxSize={10 * 1024 * 1024} // 10MB
  accept={{ 'image/*': ['.png', '.jpg', '.jpeg'] }}
  multiple
/>

{files.map((file, index) => (
  <FilePreview
    key={index}
    file={file}
    onRemove={() => setFiles(files.filter((_, i) => i !== index))}
  />
))}
```

- Built-in drag & drop with react-dropzone
- File type and size validation
- Visual feedback for drag states
- File preview with icons

## Architecture

### Database & Authentication

**Supabase** is the backend, providing PostgreSQL database, authentication, Row Level Security (RLS), and real-time subscriptions.

**Schema Files:**
- [supabase/schema.sql](supabase/schema.sql) - Core schema: users, tasks, task_messages, task_notes, task_audit_log
- [supabase/messaging-schema.sql](supabase/messaging-schema.sql) - Messaging system: conversations, messages, typing status
- [supabase/migrations/](supabase/migrations/) - All incremental migrations (apply with `pnpm db:push`)

**Key Database Concepts:**
- **User Levels**: Numeric hierarchy where 1 = highest authority (L1), increasing numbers = lower authority (L2, L3, L4...). Users can only assign tasks to same-level or lower-level users.
- **Visibility System**: Tasks and notes have visibility settings (`private`, `supervisor`, `hierarchy_same`, `hierarchy_above`, `all`) enforced by RLS. `private` = participants only, `supervisor`/`hierarchy_above` = users with a lower level number than the creator, `hierarchy_same` = same or lower level number, `all` = everyone.
- **Status Workflow**: Task status transitions are enforced by a `BEFORE UPDATE` database trigger (`validate_task_status_transition`). Invalid transitions and unauthorized role actions throw exceptions — the UI cannot bypass this.
- **Audit Log**: All task status changes, field edits, and assignee changes are automatically logged to `task_audit_log` via triggers.
- **RLS Policies**: All tables use Row Level Security. Helper functions `is_task_assignee()`, `is_task_creator()`, `is_admin_user()`, `get_user_level()` are used inside policies (SECURITY DEFINER to avoid recursion).

### Supabase Client Pattern

**Four client initialization patterns (all in `apps/web/lib/supabase/`):**

1. **Server Components** ([lib/supabase/server.ts](apps/web/lib/supabase/server.ts)): Uses `createServerClient` with cookie handling via Next.js `cookies()` API
2. **Client Components** ([lib/supabase/client.ts](apps/web/lib/supabase/client.ts)): Uses `createBrowserClient` — implements singleton internally, safe to call multiple times
3. **Middleware** ([lib/supabase/middleware.ts](apps/web/lib/supabase/middleware.ts)): Handles auth session validation and route protection
4. **Admin Operations** ([lib/supabase/admin.ts](apps/web/lib/supabase/admin.ts)): Uses service role key to bypass RLS for server-side admin operations

**Auth Callback Route** ([app/auth/callback/route.ts](apps/web/app/auth/callback/route.ts)): Handles OAuth redirects and magic link verification using PKCE flow.

**In `@taskflow/features`**: Supabase is injected via `FeaturesProvider` — access it through `useServices().supabase`, never import directly.

**Always use the appropriate client for the context.** Do not create Supabase clients directly — import from these modules.

### Authentication & State Management

**Web:** [lib/auth-context.tsx](apps/web/lib/auth-context.tsx) provides `user`, `profile`, `loading`, `signIn/signOut`, and the admin "mask as" feature (`maskedAsUser`, `maskAs`, `effectiveUser`).

**Shared (`@taskflow/features`):** `useAuth()` from `packages/features/src/providers/auth-context.tsx` — same interface, injected via `FeaturesProvider`.

**Always use `useAuth()`. Never read auth state directly from Supabase in components.**

### Data Layer

**Services** (`packages/features/src/services/`):
- `tasks.ts` - Task CRUD + pagination (`getTasks` returns `{ tasks, nextCursor, hasMore }`)
- `messages.ts` - Conversation and messaging
- `task-notes.ts` - Task notes
- `task-messages.ts` - Task thread messages
- `users.ts` - User management
- `progress.ts` - Task progress updates

**React Query Hooks** (`packages/features/src/hooks/`):
- `use-tasks.ts` - `useTasks()` (infinite query, flattened `tasks` array + `fetchNextPage`), `useChangeTaskStatus()`, `useUpdateTask()`, `useDeleteTask()`
- `use-conversations.ts` - Conversation queries
- `use-chat-messages.ts` - Message queries with real-time subscriptions
- `use-users.ts` - User queries
- `use-task-notes.ts` - Task notes queries

Use hooks in components — never call services directly. They handle caching, optimistic updates, rollback on error, and real-time invalidation.

### UI Components

**Shared feature components** → `packages/features/src/components/` (see structure above)

**Web-only primitives** (`apps/web/components/ui/`):
- shadcn/ui primitives: Button, Dialog, Card, Input, etc.
- Custom: `data-table.tsx` (TanStack Table), `file-upload.tsx` (Drag & Drop)

**Web-only providers** (`apps/web/components/providers/`): ThemeProvider, QueryProvider, MotionProvider

**shadcn/ui Configuration** ([components.json](apps/web/components.json)):
- Style: `new-york`, Base color: `neutral`, Icons: `lucide-react`
- Add components: `npx shadcn@latest add <component-name>` (run from `apps/web/`)

### Routing & Middleware

**App Router Structure** (`apps/web/app/`):
- [app/page.tsx](apps/web/app/page.tsx) - Messages/conversations (root route)
- [app/tasks/page.tsx](apps/web/app/tasks/page.tsx) - Task list (Kanban)
- [app/tasks/[id]/page.tsx](apps/web/app/tasks/%5Bid%5D/page.tsx) - Task detail
- [app/login/page.tsx](apps/web/app/login/page.tsx) - Login page
- [app/admin/users/](apps/web/app/admin/users/) - Admin user management (Server Actions in `actions.ts`)
- [app/settings/page.tsx](apps/web/app/settings/page.tsx) - User settings
- [app/chat/page.tsx](apps/web/app/chat/page.tsx) - Chat (alias for messages)
- [app/chitchat/page.tsx](apps/web/app/chitchat/page.tsx) - Voice/video channels

**Middleware** ([middleware.ts](apps/web/middleware.ts)):
- Refreshes Supabase auth session on every request
- Protects routes: redirects unauthenticated users to `/login`
- Public routes: `/login`, `/api/auth/*`

### Type System

Types live in two places depending on context:

- **`@taskflow/core`** — canonical shared types used by features package and desktop: `TaskWithUsers`, `ConversationWithMembers`, `TaskStatus`, `TaskPriority`, `Visibility`, etc.
- **`apps/web/lib/types.ts`** — re-exports from core + web-specific extensions

In `apps/web/` components import from `@/lib/types`. In `packages/features/` import from `@taskflow/core`. Never redefine database types.

### Theme System

**Dynamic theming** ([apps/web/lib/theme/](apps/web/lib/theme/)):
- `presets.ts` - Theme presets with CSS variable configurations
- `fonts.ts` - Font configurations
- `utils.ts` - Theme application utilities

Theme configuration stored in `app_settings` table, applied dynamically via CSS variables.

## Important Patterns

### Creating New Features with Server Actions

When adding admin functionality or mutations, use Next.js Server Actions (web only):
- Define server actions in files with `'use server'` directive
- See [app/admin/users/actions.ts](apps/web/app/admin/users/actions.ts) for example

### Adding shadcn/ui Components

```bash
cd apps/web && npx shadcn@latest add <component-name>
```

Components are added to `apps/web/components/ui/`.

### Working with Realtime

Tables with real-time enabled:
- `task_messages`, `messages`, `typing_status`, `message_reads`

Use Supabase channels to subscribe to changes. See [packages/features/src/hooks/use-chat-messages.ts](packages/features/src/hooks/use-chat-messages.ts) for the real-time subscription pattern.

### RLS Policy Development

When modifying RLS policies:
1. Understand the hierarchical level system (lower number = higher authority)
2. Test with different user levels and visibility settings
3. Admin users (`is_admin = true`) typically bypass all restrictions
4. Use `auth.uid()` to get current authenticated user in policies

## Environment Setup

Required environment variables (see [.env.example](.env.example)):
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY=
SUPABASE_SERVICE_ROLE_KEY=  # Optional: only needed for admin operations
```

Get these from: Supabase Dashboard → Project Settings → API

