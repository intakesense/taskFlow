# Task System — Outstanding Issues

> Last updated: 2026-04-08

---

## Bugs (break existing behaviour)

### 1. Full-text search broken with pagination
Client-side string filter in `tasks-container-social.tsx` only searches the current loaded page, not all tasks. With infinite scroll in place users will get incomplete results.

**Fix:** Add `search_vector tsvector` column to `tasks` with a GIN index and a trigger to keep it updated. Pass a `search` param through `getTasks()` → `useInfiniteQuery` and filter server-side.

---

## Critical (before production)

### 2. Real-time subscription too broad
`packages/features/src/hooks/use-tasks.ts` subscribes to every change on the `tasks` table for every user. At scale this means every write notifies every connected client and triggers a full refetch.

**Fix:** Filter the subscription to `assigned_by = auth.uid()` OR tasks the user is assigned to.

### 3. Hard delete loses audit trail
`deleteTask()` in `packages/features/src/services/tasks.ts` does a hard `DELETE`. Deleted tasks vanish from `task_audit_log` (cascade). Breaks compliance and "who deleted this?" questions.

**Fix:** Soft delete — add a `deleted_at` timestamptz column, filter it out of `getTasks()`, restrict hard purge to admins after a retention period.

## Feature additions

### 5. Subtasks / checklists
No `task_checklist_items` table or UI. Users cannot break down work into steps or track partial completion.

### 6. Projects / categories
Tasks are a flat list. No grouping by project, initiative, or sprint.

### 7. Task dependencies
No "blocked by" concept. Cannot prevent starting a task until its blocker is resolved.

---

## Polish

### 8. `window.confirm()` for delete
`tasks-container-social.tsx` uses a native browser confirm dialog. Should be a proper shadcn `AlertDialog`.
