# Future Fixes

## Architecture

- **BottomNavProvider in root** — Move from `DashboardLayout` to `app/layout.tsx` to avoid isolated contexts per layout instance. Files: `app/layout.tsx`, `dashboard-layout.tsx`, `bottom-nav-context.tsx`

---

## Tasks

- **Three views, inconsistent behavior** — `tasks-container.tsx` switches between KanbanView, TeamView, TasksViewSocial with different search/filter behavior. Unify or at minimum make search consistent. File: `tasks-container.tsx`
- **Visibility field not editable** — Displayed as read-only in task detail but no selector to change it. Add editor or remove display. Files: `task-detail-view.tsx`, `create-task-drawer.tsx`
- **No subtasks / dependencies** — Add `parent_task_id` for subtasks, `task_dependencies` table for blockers. Surface in task detail and kanban cards.
- **No recurring tasks** — Add `recurrence_rule` (RRULE) to tasks table + recurrence picker in create drawer.
- **No task templates** — Add `task_templates` table + "Save as template" / "Create from template" in the drawer.
- **No bulk actions** — Multi-select on kanban/list for bulk status change and reassign.
- **No team capacity view** — Show each member's open task count before assigning more.
- **No saved filters** — Search/filter state is ephemeral. Store named filter sets per user.
- **Soft deletes missing** — `ON DELETE CASCADE` on `task_assignees` destroys history when a user is deleted. Add `deleted_at` to users, switch to `ON DELETE SET NULL`. File: `schema.sql`

---

## Messages

- **No message search** — Full-text search on `messages.content` via Postgres `tsvector` + search bar in UI.
- **No message editing or deletion** — Add `edited_at` column + edit/delete actions in message context menu for sender.

---

## Voice / ChitChat

- **No screen sharing UI** — Daily.co supports it but no button or viewer exists in the UI.
- **No meeting recording** — Use Daily.co cloud recording API. Store URLs in `voice_recordings` table.

---

## Admin / User Management

- **`reports_to` collected but unused** — Stored in DB, never used in permissions, notifications, or org chart. Build org chart or remove from admin form. Files: `app/admin/users/`, `schema.sql`
- **No circular hierarchy validation** — Nothing prevents A → B → A in `reports_to` chain. Add acyclic check on update.
- **No user offboarding** — Hard delete only option. Add `deactivated_at` + deactivation flow that prompts to reassign open tasks.
- **No role-based permission config** — Permissions hardcoded by level. Add `role_permissions` table configurable from admin UI.

---


---

## Backlog (Industry Standard Gaps)

| Feature | Notes |
|---|---|
| Task due date reminders | Proactive push before deadline |
| @mentions in task descriptions | Loop someone in without adding as assignee |
| Email notifications | Not everyone runs the desktop app all day |
| Task import (CSV) | Migration path from other tools |
| Keyboard shortcuts | Power user navigation |
| Task duplication | Copy task as starting point |
| Pinned messages | Highlight important messages in group chats |
| Per-chat notification settings | Mute specific groups |
| Task tags / labels | Freeform categorization beyond status + priority |
| Dashboard / home screen | "My tasks due today", unread messages, blocked tasks |
| Time tracking | Log hours for billing or capacity |
| Guest / external user access | Contractor access without full employee permissions |
