-- Migration: Fix infinite recursion in tasks RLS policies
--
-- Root cause: The UPDATE policy on `tasks` references `task_assignees`,
-- whose SELECT policy in turn references `tasks`, creating a circular
-- policy evaluation loop (42P17).
--
-- Fix: Replace the cross-table subqueries with SECURITY DEFINER helper
-- functions.  These execute as the defining role (supabase_admin) and
-- therefore bypass RLS, breaking the recursion.
-- =====================================================

-- ----------------------------------------------------------------------------
-- 1. SECURITY DEFINER helpers (bypass RLS, used inside policies)
-- ----------------------------------------------------------------------------

-- Returns TRUE if p_user_id is an assignee of p_task_id
CREATE OR REPLACE FUNCTION is_task_assignee(p_task_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
SET search_path TO public
STABLE
AS $$
    SELECT EXISTS (
        SELECT 1 FROM task_assignees
        WHERE task_id = p_task_id AND user_id = p_user_id
    );
$$;

-- Returns TRUE if p_user_id is the creator (assigned_by) of p_task_id
CREATE OR REPLACE FUNCTION is_task_creator(p_task_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
SET search_path TO public
STABLE
AS $$
    SELECT EXISTS (
        SELECT 1 FROM tasks
        WHERE id = p_task_id AND assigned_by = p_user_id
    );
$$;

-- Returns TRUE if p_user_id is an admin
CREATE OR REPLACE FUNCTION is_admin_user(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
SET search_path TO public
STABLE
AS $$
    SELECT EXISTS (
        SELECT 1 FROM users
        WHERE id = p_user_id AND is_admin = true
    );
$$;

-- ----------------------------------------------------------------------------
-- 2. Rewrite tasks RLS policies using the helpers
-- ----------------------------------------------------------------------------

DROP POLICY IF EXISTS "Users can view tasks based on visibility" ON tasks;
DROP POLICY IF EXISTS "Users can create tasks for same or lower level" ON tasks;
DROP POLICY IF EXISTS "Task creator and assignees can update tasks" ON tasks;

CREATE POLICY "Users can view tasks based on visibility"
ON tasks FOR SELECT
TO authenticated
USING (
    assigned_by = auth.uid()
    OR is_task_assignee(id, auth.uid())
    OR is_admin_user(auth.uid())
);

CREATE POLICY "Users can create tasks for same or lower level"
ON tasks FOR INSERT
TO authenticated
WITH CHECK (
    assigned_by = auth.uid()
    OR is_admin_user(auth.uid())
);

CREATE POLICY "Task creator and assignees can update tasks"
ON tasks FOR UPDATE
TO authenticated
USING (
    assigned_by = auth.uid()
    OR is_task_assignee(id, auth.uid())
    OR is_admin_user(auth.uid())
);

-- ----------------------------------------------------------------------------
-- 3. Rewrite task_assignees RLS policies using the helpers
-- ----------------------------------------------------------------------------

DROP POLICY IF EXISTS "Users can view task assignees" ON task_assignees;
DROP POLICY IF EXISTS "Task creator can add assignees" ON task_assignees;
DROP POLICY IF EXISTS "Task creator can remove assignees" ON task_assignees;

CREATE POLICY "Users can view task assignees"
ON task_assignees FOR SELECT
TO authenticated
USING (
    user_id = auth.uid()
    OR is_task_creator(task_id, auth.uid())
    OR is_task_assignee(task_id, auth.uid())
    OR is_admin_user(auth.uid())
);

CREATE POLICY "Task creator can add assignees"
ON task_assignees FOR INSERT
TO authenticated
WITH CHECK (
    is_task_creator(task_id, auth.uid())
    OR is_admin_user(auth.uid())
);

CREATE POLICY "Task creator can remove assignees"
ON task_assignees FOR DELETE
TO authenticated
USING (
    is_task_creator(task_id, auth.uid())
    OR is_admin_user(auth.uid())
);

-- ----------------------------------------------------------------------------
-- 4. Rewrite task_messages RLS policies using the helpers
-- ----------------------------------------------------------------------------

DROP POLICY IF EXISTS "Task participants can view messages" ON task_messages;
DROP POLICY IF EXISTS "Task participants can send messages" ON task_messages;

CREATE POLICY "Task participants can view messages"
ON task_messages FOR SELECT
TO authenticated
USING (
    is_task_creator(task_id, auth.uid())
    OR is_task_assignee(task_id, auth.uid())
    OR is_admin_user(auth.uid())
);

CREATE POLICY "Task participants can send messages"
ON task_messages FOR INSERT
TO authenticated
WITH CHECK (
    sender_id = auth.uid()
    AND (
        is_task_creator(task_id, auth.uid())
        OR is_task_assignee(task_id, auth.uid())
    )
);

-- ----------------------------------------------------------------------------
-- 5. Rewrite task_notes SELECT policy using the helpers
-- ----------------------------------------------------------------------------

DROP POLICY IF EXISTS "Notes visible based on visibility setting" ON task_notes;

CREATE POLICY "Notes visible based on visibility setting"
ON task_notes FOR SELECT
TO authenticated
USING (
    added_by = auth.uid()
    OR is_task_creator(task_id, auth.uid())
    OR is_task_assignee(task_id, auth.uid())
    OR is_admin_user(auth.uid())
);

-- ----------------------------------------------------------------------------
-- 6. Add missing DELETE policy on tasks (creator + admin only)
-- ----------------------------------------------------------------------------

DROP POLICY IF EXISTS "Task creator and admins can delete tasks" ON tasks;

CREATE POLICY "Task creator and admins can delete tasks"
ON tasks FOR DELETE
TO authenticated
USING (
    assigned_by = auth.uid()
    OR is_admin_user(auth.uid())
);