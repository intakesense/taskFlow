-- Migration: Replace hierarchy-based note visibility with explicit user list
--
-- Instead of visibility enum values (private/supervisor/hierarchy_same/etc),
-- notes now store an explicit array of user IDs who can see them.
-- Empty array = all task participants can see (same as old 'all').
-- Non-empty array = only those specific users + note author + admin.

-- 1. Add visible_to column (uuid array, defaults to empty = everyone)
ALTER TABLE task_notes
  ADD COLUMN IF NOT EXISTS visible_to uuid[] NOT NULL DEFAULT '{}';

-- 2. Migrate existing data
UPDATE task_notes SET visible_to = '{}';

-- 3. Drop old RLS policy that depends on visibility column (must happen before column drop)
DROP POLICY IF EXISTS "Notes visible based on visibility setting" ON task_notes;

-- 4. Drop old visibility column
ALTER TABLE task_notes DROP COLUMN IF EXISTS visibility;

-- 5. Create new RLS SELECT policy
DROP POLICY IF EXISTS "Notes visible based on visibility setting" ON task_notes;

CREATE POLICY "Notes visible based on visibility setting"
ON task_notes FOR SELECT
TO authenticated
USING (
    -- Admins see everything
    is_admin_user((SELECT auth.uid()))

    -- Note author always sees their own note
    OR added_by = (SELECT auth.uid())

    -- Task creator always sees all notes on their task
    OR is_task_creator(task_id, (SELECT auth.uid()))

    -- visible_to is empty → any task participant can see
    OR (
        array_length(visible_to, 1) IS NULL
        AND is_task_assignee(task_id, (SELECT auth.uid()))
    )

    -- visible_to is populated → only listed users can see
    OR (SELECT auth.uid()) = ANY(visible_to)
);