-- Migration: Task Performance Indexes
--
-- Adds indexes for common task query patterns to prevent performance issues at scale.
-- Referenced in TASK_SYSTEM_ARCHITECTURE_REVIEW.md section 5.4
--
-- Without these indexes:
-- - Kanban columns (filter by status) require full table scans
-- - Deadline queries (overdue, upcoming) scan all tasks
-- - Combined filters multiply the overhead

-- Index for status-based Kanban columns
-- Covers: getTasks(status: 'pending'), Kanban column queries
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);

-- Index for deadline-based queries
-- Covers: overdue tasks, tasks due this week, deadline sorting
-- Partial index: only tasks with deadlines (many tasks may not have deadlines)
CREATE INDEX IF NOT EXISTS idx_tasks_deadline ON tasks(deadline)
WHERE deadline IS NOT NULL;

-- Composite index for status + deadline filtering
-- Covers: "show pending tasks due this week", "overdue in-progress tasks"
CREATE INDEX IF NOT EXISTS idx_tasks_status_deadline ON tasks(status, deadline)
WHERE deadline IS NOT NULL;

-- Index for assigned_by lookups
-- Covers: "tasks I created" filter, RLS policy checks
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_by ON tasks(assigned_by);

-- Index for created_at ordering with status
-- Covers: paginated task lists sorted by creation date within status
CREATE INDEX IF NOT EXISTS idx_tasks_status_created_at ON tasks(status, created_at DESC);

-- Add comment for documentation
COMMENT ON INDEX idx_tasks_status IS 'Supports Kanban column queries and status filtering';
COMMENT ON INDEX idx_tasks_deadline IS 'Supports deadline-based queries (overdue, upcoming)';
COMMENT ON INDEX idx_tasks_status_deadline IS 'Supports combined status+deadline filters';
COMMENT ON INDEX idx_tasks_assigned_by IS 'Supports "tasks I created" filter and RLS checks';
COMMENT ON INDEX idx_tasks_status_created_at IS 'Supports paginated task lists with status filtering';
