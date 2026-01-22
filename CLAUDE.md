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

- Validation schemas located in `lib/schemas/`:
  - `lib/schemas/auth.ts` - Login and signup schemas
  - `lib/schemas/task.ts` - Task creation/update schemas
  - `lib/schemas/user.ts` - User management schemas
  - `lib/schemas/message.ts` - Message and conversation schemas
- Never use manual `useState` for form fields
- See `app/login/page.tsx`, `components/tasks/create-task-drawer.tsx`, and `components/messages/new-chat-dialog.tsx` for reference implementations

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
- See `app/login/page.tsx` and `app/page.tsx` for examples

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
- See [components/ui/data-table.tsx](components/ui/data-table.tsx) for implementation

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
- [supabase/schema.sql](supabase/schema.sql) - Core schema: users, tasks, task_messages, task_notes
- [supabase/messaging-schema.sql](supabase/messaging-schema.sql) - Messaging system: conversations, messages, typing status

**Key Database Concepts:**
- **User Levels**: Numeric hierarchy where 1 = highest authority (L1), increasing numbers = lower authority (L2, L3, L4...). Users can only assign tasks to same-level or lower-level users.
- **Visibility System**: Tasks and notes have visibility settings (`private`, `supervisor`, `hierarchy_same`, `hierarchy_above`, `all`) that control who can view them via RLS policies.
- **RLS Policies**: All tables use Row Level Security. Policies enforce hierarchical access control based on user levels and relationships.

### Supabase Client Pattern

**Four client initialization patterns:**

1. **Server Components** ([lib/supabase/server.ts](lib/supabase/server.ts)): Uses `createServerClient` with cookie handling via Next.js `cookies()` API
2. **Client Components** ([lib/supabase/client.ts](lib/supabase/client.ts)): Uses `createBrowserClient` for client-side operations
3. **Middleware** ([lib/supabase/middleware.ts](lib/supabase/middleware.ts)): Handles auth session validation (via `getClaims()`) and route protection
4. **Admin Operations** ([lib/supabase/admin.ts](lib/supabase/admin.ts)): Uses service role key to bypass RLS for server-side admin operations

**Auth Callback Route** ([app/auth/callback/route.ts](app/auth/callback/route.ts)): Handles OAuth redirects and magic link verification using PKCE flow.

**Always use the appropriate client for the context.** Do not create Supabase clients directly - import from these modules.

### Authentication & State Management

**AuthContext** ([lib/auth-context.tsx](lib/auth-context.tsx)) provides:
- Authentication state (`user`, `profile`, `loading`)
- Auth methods (`signIn`, `signUp`, `signOut`)
- Admin "mask as" feature (`maskedAsUser`, `maskAs`, `effectiveUser`) - allows admins to view the app as another user
- Profile refresh functionality

**Access auth via the `useAuth()` hook in client components.**

### Data Layer

**Service Layer Pattern** ([lib/services/](lib/services/)):
- [lib/services/tasks.ts](lib/services/tasks.ts) - Task CRUD operations
- [lib/services/users.ts](lib/services/users.ts) - User management
- [lib/services/messages.ts](lib/services/messages.ts) - Conversation and messaging
- [lib/services/notes.ts](lib/services/notes.ts) - Task notes

Services use the client-side Supabase client and return typed data. Import services via [lib/services/index.ts](lib/services/index.ts).

**React Query Hooks** ([hooks/](hooks/)):
- [hooks/use-tasks.ts](hooks/use-tasks.ts) - Task queries and mutations
- [hooks/use-conversations.ts](hooks/use-conversations.ts) - Conversation queries
- [hooks/use-chat-messages.ts](hooks/use-chat-messages.ts) - Message queries with real-time subscriptions
- [hooks/use-users.ts](hooks/use-users.ts) - User queries
- [hooks/use-notes.ts](hooks/use-notes.ts) - Task notes queries

Use these hooks in components instead of calling services directly. They provide caching, automatic refetching, and optimistic updates.

### UI Components

**Component Structure:**
- [components/ui/](components/ui/) - shadcn/ui primitives + custom components
  - Primitives: Button, Dialog, Card, Input, etc.
  - Custom: `data-table.tsx` (TanStack Table), `file-upload.tsx` (Drag & Drop)
- [components/layout/](components/layout/) - Layout components (Sidebar, DashboardLayout)
- [components/tasks/](components/tasks/) - Task-specific components
- [components/messages/](components/messages/) - Messaging components
- [components/providers/](components/providers/) - Context providers (ThemeProvider, QueryProvider)
- [components/error-boundary.tsx](components/error-boundary.tsx) - Error boundary wrapper

**shadcn/ui Configuration** ([components.json](components.json)):
- Style: `new-york`
- Base color: `neutral`
- Icon library: `lucide-react`
- Path aliases configured: `@/components`, `@/lib`, `@/hooks`

### Routing & Middleware

**App Router Structure:**
- [app/page.tsx](app/page.tsx) - Messages/conversations (root route)
- [app/tasks/page.tsx](app/tasks/page.tsx) - Task list view
- [app/tasks/[id]/page.tsx](app/tasks/[id]/page.tsx) - Task detail view
- [app/login/page.tsx](app/login/page.tsx) - Login page
- [app/admin/users/](app/admin/users/) - Admin user management
- [app/settings/page.tsx](app/settings/page.tsx) - User settings

**Middleware** ([middleware.ts](middleware.ts)):
- Refreshes Supabase auth session on every request
- Protects routes: redirects unauthenticated users to `/login`
- Redirects authenticated users away from `/login` to root
- Public routes: `/`, `/login`, `/api/auth/*`
- pnpm db:types # After changing database schema

### Type System

**All types defined in** [lib/types.ts](lib/types.ts):
- Database types: `User`, `Task`, `TaskMessage`, `TaskNote`, `Conversation`, `Message`
- Extended types with relations: `TaskWithUsers`, `MessageWithSender`, `ConversationWithMembers`
- Enums: `TaskStatus`, `TaskPriority`, `Visibility`, `UserLevel`

**Always import types from** `@/lib/types` - do not redefine database types.

### Theme System

**Dynamic theming** ([lib/theme/](lib/theme/)):
- [lib/theme/presets.ts](lib/theme/presets.ts) - Theme presets with CSS variable configurations
- [lib/theme/fonts.ts](lib/theme/fonts.ts) - Font configurations
- [lib/theme/utils.ts](lib/theme/utils.ts) - Theme application utilities

Theme configuration stored in `app_settings` table, applied dynamically via CSS variables.

## Important Patterns

### Creating New Features with Server Actions

When adding admin functionality or mutations, use Next.js Server Actions:
- Define server actions in files with `'use server'` directive
- Import and use in client components
- See [app/admin/users/actions.ts](app/admin/users/actions.ts) for example

### Adding shadcn/ui Components

```bash
npx shadcn@latest add <component-name>
```

Components are automatically added to [components/ui/](components/ui/) with correct path aliases.

### Working with Realtime

Tables with real-time enabled (see schema files):
- `task_messages`
- `messages`
- `typing_status`
- `message_reads`

Use Supabase channels to subscribe to changes. See [hooks/use-chat-messages.ts](hooks/use-chat-messages.ts) for real-time subscription pattern.

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

