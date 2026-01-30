-- ============================================================================
-- MULTI-ASSIGNEE TASKS SCHEMA
-- Enables tasks to be assigned to multiple users
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Task Assignees Junction Table
-- ----------------------------------------------------------------------------
CREATE TABLE task_assignees (
    task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    assigned_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (task_id, user_id)
);

-- Indexes for efficient lookups
CREATE INDEX idx_task_assignees_task ON task_assignees(task_id);
CREATE INDEX idx_task_assignees_user ON task_assignees(user_id);

-- Enable realtime for assignment changes
ALTER PUBLICATION supabase_realtime ADD TABLE task_assignees;

-- ----------------------------------------------------------------------------
-- Migrate existing assigned_to data to junction table
-- ----------------------------------------------------------------------------
INSERT INTO task_assignees (task_id, user_id, assigned_at)
SELECT id, assigned_to, created_at
FROM tasks
WHERE assigned_to IS NOT NULL;

-- ----------------------------------------------------------------------------
-- Drop existing RLS policies that depend on assigned_to column
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view tasks based on visibility" ON tasks;
DROP POLICY IF EXISTS "Users can create tasks for same or lower level" ON tasks;
DROP POLICY IF EXISTS "Task participants can view messages" ON task_messages;
DROP POLICY IF EXISTS "Task participants can send messages" ON task_messages;
DROP POLICY IF EXISTS "Notes visible based on visibility setting" ON task_notes;

-- ----------------------------------------------------------------------------
-- Remove the old assigned_to column
-- ----------------------------------------------------------------------------
ALTER TABLE tasks DROP COLUMN assigned_to;

-- ----------------------------------------------------------------------------
-- Row Level Security Policies for task_assignees
-- ----------------------------------------------------------------------------
ALTER TABLE task_assignees ENABLE ROW LEVEL SECURITY;

-- View: Users can see assignees for tasks they can view
CREATE POLICY "Users can view task assignees"
ON task_assignees FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM tasks
        WHERE tasks.id = task_assignees.task_id
        AND (
            tasks.assigned_by = auth.uid()
            OR EXISTS (
                SELECT 1 FROM task_assignees ta2
                WHERE ta2.task_id = task_assignees.task_id
                AND ta2.user_id = auth.uid()
            )
            OR EXISTS (
                SELECT 1 FROM users
                WHERE users.id = auth.uid()
                AND users.is_admin = true
            )
        )
    )
);

-- Insert: Task creator (assigned_by) can add assignees
CREATE POLICY "Task creator can add assignees"
ON task_assignees FOR INSERT
TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1 FROM tasks
        WHERE tasks.id = task_assignees.task_id
        AND tasks.assigned_by = auth.uid()
    )
    OR EXISTS (
        SELECT 1 FROM users
        WHERE users.id = auth.uid()
        AND users.is_admin = true
    )
);

-- Delete: Task creator can remove assignees
CREATE POLICY "Task creator can remove assignees"
ON task_assignees FOR DELETE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM tasks
        WHERE tasks.id = task_assignees.task_id
        AND tasks.assigned_by = auth.uid()
    )
    OR EXISTS (
        SELECT 1 FROM users
        WHERE users.id = auth.uid()
        AND users.is_admin = true
    )
);

-- ----------------------------------------------------------------------------
-- Recreate RLS policies for tasks table using junction table
-- ----------------------------------------------------------------------------
CREATE POLICY "Users can view tasks based on visibility"
ON tasks FOR SELECT
TO authenticated
USING (
    assigned_by = auth.uid()
    OR EXISTS (
        SELECT 1 FROM task_assignees
        WHERE task_assignees.task_id = tasks.id
        AND task_assignees.user_id = auth.uid()
    )
    OR EXISTS (
        SELECT 1 FROM users
        WHERE users.id = auth.uid()
        AND users.is_admin = true
    )
);

CREATE POLICY "Users can create tasks for same or lower level"
ON tasks FOR INSERT
TO authenticated
WITH CHECK (
    assigned_by = auth.uid()
    OR EXISTS (
        SELECT 1 FROM users
        WHERE users.id = auth.uid()
        AND users.is_admin = true
    )
);

CREATE POLICY "Task creator and assignees can update tasks"
ON tasks FOR UPDATE
TO authenticated
USING (
    assigned_by = auth.uid()
    OR EXISTS (
        SELECT 1 FROM task_assignees
        WHERE task_assignees.task_id = tasks.id
        AND task_assignees.user_id = auth.uid()
    )
    OR EXISTS (
        SELECT 1 FROM users
        WHERE users.id = auth.uid()
        AND users.is_admin = true
    )
);

-- ----------------------------------------------------------------------------
-- Recreate RLS policies for task_messages table using junction table
-- ----------------------------------------------------------------------------
CREATE POLICY "Task participants can view messages"
ON task_messages FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM tasks
        WHERE tasks.id = task_messages.task_id
        AND (
            tasks.assigned_by = auth.uid()
            OR EXISTS (
                SELECT 1 FROM task_assignees
                WHERE task_assignees.task_id = tasks.id
                AND task_assignees.user_id = auth.uid()
            )
        )
    )
    OR EXISTS (
        SELECT 1 FROM users
        WHERE users.id = auth.uid()
        AND users.is_admin = true
    )
);

CREATE POLICY "Task participants can send messages"
ON task_messages FOR INSERT
TO authenticated
WITH CHECK (
    sender_id = auth.uid()
    AND EXISTS (
        SELECT 1 FROM tasks
        WHERE tasks.id = task_messages.task_id
        AND (
            tasks.assigned_by = auth.uid()
            OR EXISTS (
                SELECT 1 FROM task_assignees
                WHERE task_assignees.task_id = tasks.id
                AND task_assignees.user_id = auth.uid()
            )
        )
    )
);

-- ----------------------------------------------------------------------------
-- Recreate RLS policies for task_notes table using junction table
-- ----------------------------------------------------------------------------
CREATE POLICY "Notes visible based on visibility setting"
ON task_notes FOR SELECT
TO authenticated
USING (
    added_by = auth.uid()
    OR EXISTS (
        SELECT 1 FROM tasks
        WHERE tasks.id = task_notes.task_id
        AND (
            tasks.assigned_by = auth.uid()
            OR EXISTS (
                SELECT 1 FROM task_assignees
                WHERE task_assignees.task_id = tasks.id
                AND task_assignees.user_id = auth.uid()
            )
        )
    )
    OR EXISTS (
        SELECT 1 FROM users
        WHERE users.id = auth.uid()
        AND users.is_admin = true
    )
);

-- ----------------------------------------------------------------------------
-- Helper Function: Check if user is assignee
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION is_task_assignee(p_task_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
AS $$
    SELECT EXISTS (
        SELECT 1 FROM task_assignees
        WHERE task_id = p_task_id AND user_id = p_user_id
    );
$$;
