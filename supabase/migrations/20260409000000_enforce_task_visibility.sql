-- Migration: Enforce task and note visibility in RLS
--
-- The visibility column on tasks and task_notes has been stored since the
-- initial schema but was never checked by SELECT policies. Every participant
-- (creator, assignee, admin) could see every task regardless of its
-- visibility setting. This migration makes the column meaningful.
--
-- Visibility levels (from constants/index.ts):
--   'private'         -- creator + direct assignees only
--   'supervisor'      -- above + users whose level < creator's level (higher authority)
--   'hierarchy_same'  -- above + users whose level <= creator's level (same or higher)
--   'hierarchy_above' -- same as supervisor (above only)
--   'all'             -- everyone (previous behaviour, unchanged)
--
-- User levels: lower number = higher authority (L1 > L2 > L3 …)

-- ----------------------------------------------------------------------------
-- Helper: get the level of a user (SECURITY DEFINER to bypass RLS)
-- Drop first to allow renaming the parameter from 'user_id' to 'p_user_id'
-- ----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS get_user_level(UUID);
CREATE OR REPLACE FUNCTION get_user_level(p_user_id UUID)
RETURNS INTEGER
LANGUAGE SQL
SECURITY DEFINER
SET search_path TO public
STABLE
AS $$
    SELECT level FROM users WHERE id = p_user_id;
$$;

-- ----------------------------------------------------------------------------
-- Rewrite tasks SELECT policy to honour visibility
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view tasks based on visibility" ON tasks;

CREATE POLICY "Users can view tasks based on visibility"
ON tasks FOR SELECT
TO authenticated
USING (
    -- Admins always see everything
    is_admin_user((SELECT auth.uid()))

    -- Creator always sees their own tasks
    OR assigned_by = (SELECT auth.uid())

    -- Direct assignees always see their tasks
    OR is_task_assignee(id, (SELECT auth.uid()))

    -- 'all' visibility: any authenticated user can see
    OR visibility = 'all'

    -- 'supervisor' / 'hierarchy_above': user has strictly higher authority
    -- (lower level number) than the creator
    OR (
        visibility IN ('supervisor', 'hierarchy_above')
        AND get_user_level((SELECT auth.uid())) < get_user_level(assigned_by)
    )

    -- 'hierarchy_same': user has same or higher authority than the creator
    OR (
        visibility = 'hierarchy_same'
        AND get_user_level((SELECT auth.uid())) <= get_user_level(assigned_by)
    )
);

-- ----------------------------------------------------------------------------
-- Rewrite task_notes SELECT policy to honour visibility
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Notes visible based on visibility setting" ON task_notes;

CREATE POLICY "Notes visible based on visibility setting"
ON task_notes FOR SELECT
TO authenticated
USING (
    -- Admins always see all notes
    is_admin_user((SELECT auth.uid()))

    -- Note author always sees their own notes
    OR added_by = (SELECT auth.uid())

    -- Task creator always sees all notes on their task
    OR is_task_creator(task_id, (SELECT auth.uid()))

    -- 'all' visibility: any task participant can see
    OR (
        visibility = 'all'
        AND (
            is_task_assignee(task_id, (SELECT auth.uid()))
        )
    )

    -- 'private': only the author (already covered above) and task assignees
    OR (
        visibility = 'private'
        AND is_task_assignee(task_id, (SELECT auth.uid()))
    )

    -- 'supervisor' / 'hierarchy_above': user has strictly higher authority
    -- than the note author
    OR (
        visibility IN ('supervisor', 'hierarchy_above')
        AND get_user_level((SELECT auth.uid())) < get_user_level(added_by)
    )

    -- 'hierarchy_same': user has same or higher authority than the note author
    OR (
        visibility = 'hierarchy_same'
        AND get_user_level((SELECT auth.uid())) <= get_user_level(added_by)
    )
);

COMMENT ON FUNCTION get_user_level(UUID) IS 'Returns the hierarchy level of a user (lower = higher authority). Used by visibility RLS policies.';
