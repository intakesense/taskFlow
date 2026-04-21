# Future Fixes

---

## Architecture & Layout

### BottomNavProvider Architecture Refactor

**Issue:** `DashboardLayout` creates its own `BottomNavProvider`, so multiple layouts = multiple isolated contexts. This causes state fragmentation and unnecessary re-renders.

**Current workaround:** Hide logic placed inside child components (e.g., `VoiceChannelPanel`) that render within the same `DashboardLayout` instance.

**Proper fix:**
1. Move `BottomNavProvider` to `app/layout.tsx` (single root provider)
2. Remove provider from `DashboardLayout`, keep only consumer logic
3. `DashboardLayout` uses `useBottomNavVisibility()` directly

**Files involved:**
- `app/layout.tsx`
- `components/layout/dashboard-layout.tsx`
- `components/layout/bottom-nav-context.tsx`

---

## Tasks

### Assignees Cannot Complete Their Own Work
**Issue:** Status transition logic (`in_progress → archived`) is gated to the task *creator* only. Assignees cannot mark their own work done — the creator becomes a bottleneck for every task they assign.

**Fix:** Split into two steps: assignee marks "ready for review", creator accepts or requests changes. Or make completion creator-gated only when an approval workflow is explicitly enabled on the task.

**Files involved:**
- `supabase/migrations/` — status transition trigger
- `packages/features/src/hooks/use-tasks.ts`
- `packages/features/src/components/tasks/task-detail-view.tsx`

---

### On-Hold Reason Is Collected But Unused
**Issue:** Pausing a task requires entering a reason, but the reason is never shown to the creator, never triggers a notification, and has no reporting. Mandatory input that goes nowhere.

**Fix:** Either (a) send a notification to the task creator with the reason when a task is paused, and display it in task detail, or (b) remove the requirement entirely until reporting is built.

**Files involved:**
- `packages/features/src/components/tasks/task-detail-view.tsx`
- Task messages / notification service

---

### Three Task Views With Inconsistent Behavior
**Issue:** `tasks-container.tsx` renders three different components depending on filter: KanbanView ('all'), TeamView ('team'), TasksViewSocial (others). Search and filtering behave differently in each. Users don't know what they'll see when switching.

**Fix:** Unify into a single view component that handles all filter modes. Or at minimum make search work consistently across all three.

**Files involved:**
- `packages/features/src/components/tasks/tasks-container.tsx`

---

### Priority Filter Missing From UI
**Issue:** Tasks have a priority field in the data model, displayed on cards, but there is no way to filter or sort by priority anywhere in the UI.

**Fix:** Add priority filter option to the task filter bar.

**Files involved:**
- `packages/features/src/components/tasks/tasks-container.tsx`
- `packages/features/src/services/tasks.ts`

---

### Visibility Field Shown But Not Editable
**Issue:** Task detail view displays the visibility setting (read-only label) but there is no control to change it after creation. Tasks are always created as `private` with no way to update.

**Fix:** Add visibility selector to task detail edit mode, or remove the display entirely until editing is supported.

**Files involved:**
- `packages/features/src/components/tasks/task-detail-view.tsx`
- `packages/features/src/components/tasks/create-task-drawer.tsx`

---

### No Task Dependencies / Subtasks
**Issue (Industry Gap):** No way to say "Task B depends on Task A" or break work into subtasks. A core feature of every task management product (Asana, Linear, Jira, Todoist). Without it, complex work coordination happens in chat instead of the task system.

**Fix:** Add `parent_task_id` column to tasks table for subtasks. Add `task_dependencies(task_id, depends_on_task_id)` table. Surface in UI as a subtask list and dependency indicator on task cards.

---

### No Recurring Tasks
**Issue (Industry Gap):** All tasks are one-off. No way to create a task that repeats weekly, monthly, etc. Common in every standard task tool.

**Fix:** Add `recurrence_rule` (RRULE string) to tasks table. Add recurrence picker to create task drawer. Background job generates the next occurrence when current one is archived.

---

### No Task Templates
**Issue (Industry Gap):** Can't save a task pattern (name, description, assignees, priority) as a reusable template. Every recurring task type has to be recreated manually.

**Fix:** Add `task_templates` table. Add "Save as template" and "Create from template" options in the task drawer.

---

### No Bulk Actions
**Issue (Industry Gap):** Can't select multiple tasks to update status, reassign, or archive them together. Required for any manager handling more than a handful of tasks.

**Fix:** Add multi-select mode to task list/kanban. Implement bulk status change and bulk reassign actions.

---

### No Team Capacity View
**Issue (Industry Gap):** No way to see how many open tasks someone has before assigning them more. Managers assign work blind with no workload visibility.

**Fix:** Add a team view that shows each member's open task count and current assignments. Consider an optional "capacity" field per user.

---

### No Task Search History / Saved Filters
**Issue (Industry Gap):** Search and filter state is ephemeral. Can't save "show me all high-priority in-progress tasks assigned to me" as a named view.

**Fix:** Add saved filter sets stored per user in the database or localStorage.

---

### No Soft Deletes — Deleted Users Break Task History
**Issue:** `task_assignees` uses `ON DELETE CASCADE`. If a user account is deleted, all their task assignments and history disappear. You can't see who created or was assigned to a task if that person's account was removed.

**Fix:** Add soft delete to users (`deleted_at` column). Replace `ON DELETE CASCADE` with `ON DELETE SET NULL` or retain a display name snapshot on task records.

**Files involved:**
- `supabase/schema.sql`
- All `task_assignees` foreign key constraints

---

## Messages

### Aggressive Prefetching Hardcoded for Small Team Size
**Issue:** Messages container preloads ALL conversations on mount with a comment: "Since we only have ~20 employees, this is fast." This is a time bomb — grows silently with company size, no config to tune it.

**Fix:** Replace with lazy loading per conversation. Only fetch messages when a conversation is selected.

**Files involved:**
- `packages/features/src/components/messages/messages-container.tsx`

---

### Task Messages and Progress Updates Share a Table But Split the UI
**Issue:** `task_messages` stores both chat messages (`type='message'`) and progress updates (`type='progress'`). The UI treats them as separate features — different tabs, different search, can't see both together. The data model says "same thing," the product says "different."

**Fix:** Either (a) merge into a unified activity feed on the task where both types appear chronologically, or (b) move progress updates to a separate table to make the separation explicit and intentional.

**Files involved:**
- `packages/features/src/services/progress.ts`
- `packages/features/src/components/progress/`
- `packages/features/src/components/tasks/task-detail-view.tsx`

---

### No Way to Leave a Group Chat
**Issue:** Group settings allows adding and removing *other* members, but there is no "leave group" option for yourself. An employee added to an irrelevant group cannot remove themselves.

**Fix:** Add "Leave group" button in group settings that removes `auth.uid()` from conversation members.

**Files involved:**
- `packages/features/src/components/messages/group-settings-dialog.tsx`

---

### Read Receipts Over-Engineered For No Visible Output
**Issue:** Read receipt logic has 300ms debounce, ref tracking, and conditional skip logic — for a feature that isn't displayed anywhere in the UI yet. Complex state management protecting nothing visible.

**Fix:** Simplify to a single `markAsRead(conversationId)` call on conversation open. Build the visible "read by" UI before reintroducing the optimizations.

**Files involved:**
- `packages/features/src/components/messages/messages-container.tsx`

---

### No Message Search
**Issue (Industry Gap):** No way to search across message history. Standard in every messaging product (Slack, Teams, WhatsApp).

**Fix:** Add full-text search on `messages.content` using Postgres `tsvector`. Add search bar to messages UI.

---

### No Message Reactions
**Issue (Industry Gap):** Can't react to a message with an emoji. Table stakes in modern messaging.

**Fix:** Add `message_reactions(message_id, user_id, emoji)` table. Add reaction picker on hover.

---

### No Message Editing or Deletion
**Issue (Industry Gap):** Once sent, messages cannot be edited or deleted by the sender. Every major messaging product supports this.

**Fix:** Add `edited_at` column to messages. Add edit/delete actions to message context menu for the sender.

---

### No Thread / Reply Feature in Conversations
**Issue (Industry Gap):** No way to reply to a specific message in a thread (like Slack threads). All messages are flat.

**Fix:** Add `reply_to_id` foreign key to messages. Show quoted message in the reply UI.

---

## Voice / ChitChat

### Multi-Channel Schema, Single-Channel UI
**Issue:** The database has a `voice_channels` table designed for multiple rooms. The UI shows exactly one hardcoded "ChitChat" channel. No way to create new rooms, no scheduled meetings, no "private call with my team."

**Fix:** Add channel creation UI. Allow naming rooms. Consider scheduled/ad-hoc room types.

**Files involved:**
- `packages/features/src/components/voice/`
- `supabase/schema.sql` — `voice_channels` table

---

### Participant State Sync Never Implemented
**Issue:** `voice_channel_participants` stores `is_muted`, `is_video_on`, `is_screen_sharing` as "synced from Daily for UI display." There is no webhook handler or realtime bridge that actually syncs Daily.co participant events to Supabase. The columns are always stale after join.

**Fix:** Either (a) implement a Daily.co webhook that updates participant state in Supabase on mute/unmute events, or (b) remove the columns and rely solely on Daily.co's local participant state.

**Files involved:**
- `apps/web/app/api/daily/`
- `supabase/schema.sql` — `voice_channel_participants`

---

### Being Alone in a Voice Room Shows "Waiting for Participants" Forever
**Issue:** When you're the first (and only) person in a call, the UI shows the waiting state indefinitely with no self-view and no confirmation you're actually connected.

**Fix:** Show self-view tile when alone. Show "You're the only one here" message. Don't block the UI on participant count.

**Files involved:**
- `packages/features/src/components/voice/participant-grid.tsx`

---

### No Screen Sharing UI
**Issue (Industry Gap):** Screen sharing is in the data model (`is_screen_sharing` column) and Daily.co supports it, but there is no screen share button or viewer in the UI.

**Fix:** Add screen share toggle button. Render screen share track in the participant grid when active.

---

### No Meeting Recording
**Issue (Industry Gap):** No way to record a voice/video call. Standard feature in Teams, Zoom, Google Meet.

**Fix:** Use Daily.co's cloud recording API. Add record button for admins/room owners. Store recording URLs in a `voice_recordings` table.

---

## Admin / User Management

### Level Numbering Is Inverted vs Every Convention
**Issue:** L1 = highest authority (Director), L5 = lowest (Junior). This is backwards from how levels are understood everywhere else (L5 in tech = senior, level 1 in games = beginner). No explanation in the UI. Admins will assign levels wrong on first use.

**Fix:** Either (a) flip the numbering so L5 = Director and L1 = Junior, or (b) remove level numbers entirely from the user-facing label and show only the role name (Director, Manager, etc.) while keeping the numeric comparison internal.

**Files involved:**
- `apps/web/app/admin/users/`
- `packages/features/src/components/` — anywhere levels are displayed

---

### `reports_to` Field Collected But Never Used
**Issue:** Users have a `reports_to` supervisor field. It's set in admin, stored in the database, and never queried, displayed, or used in any permission, notification, or org chart logic anywhere in the app.

**Fix:** Either (a) build the org chart view and escalation routing that uses it, or (b) remove it from the admin form until it's needed.

**Files involved:**
- `apps/web/app/admin/users/`
- `supabase/schema.sql`

---

### No Circular Hierarchy Validation
**Issue:** No validation prevents A reporting to B while B reports to A, or a user being assigned a level that contradicts their `reports_to` chain.

**Fix:** Add a database constraint or service-layer check that validates the org chart is acyclic when `reports_to` is set.

---

### No User Offboarding Workflow
**Issue (Industry Gap):** When an employee leaves, there's no way to reassign their open tasks, archive their conversations, or deactivate their account without deleting it (which destroys history). Hard delete is the only option.

**Fix:** Add `is_active` / `deactivated_at` to the users table. Deactivated users can't log in but their task history and messages remain. Add a "deactivate user" flow in admin that prompts to reassign open tasks.

---

### No Role-Based Permission Configuration
**Issue (Industry Gap):** Permissions are hardcoded by level number. Admins cannot configure what each level can or cannot do — it's a code change, not a settings change.

**Fix:** Consider a `role_permissions` table that maps level to allowed actions. Expose in admin UI for configuring permissions per level.

---

## Desktop App

### No Auto-Updater
**Issue:** No Tauri updater plugin is configured. Users running the desktop app will never receive updates unless they manually reinstall. Critical for bug fixes and security patches.

**Fix:** Integrate `tauri-plugin-updater`. Configure update endpoint. Show "Update available" notification with one-click install.

**Files involved:**
- `apps/desktop/src-tauri/Cargo.toml`
- `apps/desktop/src-tauri/tauri.conf.json`
- `apps/desktop/src/` — update check on app start

---

### Stronghold Encryption Initialized But Not Used
**Issue:** `tauri-plugin-stronghold` is set up in Rust with Argon2 hashing, but the frontend still stores the Supabase session in plain localStorage (with a TODO comment noting the intended migration). Sensitive tokens are unencrypted on disk.

**Fix:** Complete the migration: store Supabase `access_token` and `refresh_token` in Stronghold instead of localStorage.

**Files involved:**
- `apps/desktop/src/lib/supabase.ts`
- `apps/desktop/src-tauri/src/lib.rs`

---

### No Offline Indicator or Graceful Offline Handling
**Issue:** The app has no connection status indicator and no offline queue. If the network drops, the app silently fails. Users don't know if their action succeeded or not.

**Fix:** Add a connection status listener (`navigator.onLine` + Supabase connection events). Show an "offline" banner. Queue mutations locally and replay on reconnect.

---

### No Multi-Account Support
**Issue:** Single login only. Users who have access to multiple organizations or need to switch between accounts must sign out and back in.

**Fix:** Add account switcher in settings. Store multiple sessions in Stronghold keyed by user ID.

---

## Realtime

### Task Subscription Invalidates All Queries on Any Change
**Issue:** Any change to any task invalidates ALL task queries for ALL users — `queryClient.invalidateQueries({ queryKey: taskKeys.all })`. With concurrent users, one task update causes everyone to refetch everything.

**Fix:** Use granular invalidation: `invalidateQueries({ queryKey: taskKeys.detail(taskId) })`. Filter subscriptions by the current user's visible tasks.

**Files involved:**
- `packages/features/src/hooks/use-tasks.ts`

---

## Performance

### N+1 Query Pattern on Task Assignee Fetch
**Issue:** `getTasks()` runs one query for tasks then a second query for all assignees in that batch. For large task lists this compounds. Should be a single JOIN.

**Fix:** Use Supabase's relational query syntax to fetch assignees in the same request as tasks: `.select('*, task_assignees(user_id, users(name, avatar_url))')`.

**Files involved:**
- `packages/features/src/services/tasks.ts`

---

## Missing Industry-Standard Features (Backlog)

These are features present in comparable products (Asana, Linear, Notion, ClickUp, Monday) that are completely absent and would be expected by employees used to those tools:

| Feature | Why It Matters |
|---|---|
| Task due date reminders | Proactive notifications before a deadline, not just a date field |
| @mentions in task descriptions | Tag someone to loop them in without adding as assignee |
| Task activity feed (visible) | See a timeline of all changes to a task — who changed what and when |
| Email notifications | Not every employee will run the desktop app all day |
| Task import (CSV) | Migrating from another tool requires manual re-entry today |
| Keyboard shortcuts | Power users expect to navigate without a mouse |
| Task duplication | Copy a task as a starting point for similar work |
| Pinned messages in conversations | Highlight important messages in a group chat |
| Conversation notifications per-chat | Mute specific groups without disabling all notifications |
| Task tags / labels | Freeform categorization beyond status and priority |
| Dashboard / home screen | Overview of "my tasks due today", "unread messages", "blocked tasks" |
| Time tracking | Log hours against a task for billing or capacity analysis |
| Guest / external user access | Invite a contractor without giving them full employee access |