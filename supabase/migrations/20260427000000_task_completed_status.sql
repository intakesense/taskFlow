-- Migration: Add 'completed' status for two-step task completion
--
-- New workflow:
--   in_progress → completed: Assignee marks work done (awaiting creator review)
--   completed  → archived:   Creator accepts (task fully done)
--   completed  → in_progress: Creator requests changes (back to work)
--
-- The 'completed' status means "assignee done, awaiting creator sign-off".
-- It renders as "Awaiting Review" in the UI — amber indicator on the kanban card,
-- stays in the In Progress column (no new column needed).

-- ── 1. Extend the tasks status check constraint ──────────────────────────────
ALTER TABLE tasks
  DROP CONSTRAINT IF EXISTS tasks_status_check;

ALTER TABLE tasks
  ADD CONSTRAINT tasks_status_check
  CHECK (status IN ('pending', 'in_progress', 'on_hold', 'completed', 'archived'));

-- ── 2. Replace the transition trigger ────────────────────────────────────────
CREATE OR REPLACE FUNCTION validate_task_status_transition()
RETURNS TRIGGER AS $$
DECLARE
  v_is_assignee BOOLEAN;
  v_is_creator  BOOLEAN;
  v_is_admin    BOOLEAN;
  v_current_user UUID;
BEGIN
  -- Only run when status actually changed
  IF OLD.status IS NOT DISTINCT FROM NEW.status THEN
    RETURN NEW;
  END IF;

  v_current_user := auth.uid();

  -- Service role / server-side calls have no auth.uid() — allow
  IF v_current_user IS NULL THEN
    RETURN NEW;
  END IF;

  v_is_assignee := is_task_assignee(NEW.id, v_current_user);
  v_is_creator  := (OLD.assigned_by = v_current_user);
  v_is_admin    := is_admin_user(v_current_user);

  -- Admins bypass all rules
  IF v_is_admin THEN
    RETURN NEW;
  END IF;

  -- pending → in_progress (assignee starts work)
  IF OLD.status = 'pending' AND NEW.status = 'in_progress' THEN
    IF NOT v_is_assignee THEN
      RAISE EXCEPTION 'Only assignees can start a task';
    END IF;
    RETURN NEW;
  END IF;

  -- in_progress → on_hold (assignee pauses, reason required)
  IF OLD.status = 'in_progress' AND NEW.status = 'on_hold' THEN
    IF NOT v_is_assignee THEN
      RAISE EXCEPTION 'Only assignees can put a task on hold';
    END IF;
    IF NEW.on_hold_reason IS NULL OR trim(NEW.on_hold_reason) = '' THEN
      RAISE EXCEPTION 'on_hold_reason is required when putting task on hold';
    END IF;
    RETURN NEW;
  END IF;

  -- in_progress → completed (assignee marks done, awaiting review)
  IF OLD.status = 'in_progress' AND NEW.status = 'completed' THEN
    IF NOT v_is_assignee THEN
      RAISE EXCEPTION 'Only assignees can mark a task as done';
    END IF;
    RETURN NEW;
  END IF;

  -- completed → archived (creator accepts — task fully done)
  IF OLD.status = 'completed' AND NEW.status = 'archived' THEN
    IF NOT v_is_creator THEN
      RAISE EXCEPTION 'Only the task creator can accept completion';
    END IF;
    RETURN NEW;
  END IF;

  -- completed → in_progress (creator requests changes)
  IF OLD.status = 'completed' AND NEW.status = 'in_progress' THEN
    IF NOT v_is_creator THEN
      RAISE EXCEPTION 'Only the task creator can request changes';
    END IF;
    RETURN NEW;
  END IF;

  -- on_hold → in_progress (assignee resumes)
  IF OLD.status = 'on_hold' AND NEW.status = 'in_progress' THEN
    IF NOT v_is_assignee THEN
      RAISE EXCEPTION 'Only assignees can resume a task';
    END IF;
    NEW.on_hold_reason := NULL;
    RETURN NEW;
  END IF;

  -- archived → in_progress (creator reopens)
  IF OLD.status = 'archived' AND NEW.status = 'in_progress' THEN
    IF NOT v_is_creator THEN
      RAISE EXCEPTION 'Only the task creator can reopen a task';
    END IF;
    RETURN NEW;
  END IF;

  -- in_progress → archived still allowed for creator (direct complete, legacy)
  IF OLD.status = 'in_progress' AND NEW.status = 'archived' THEN
    IF NOT v_is_creator THEN
      RAISE EXCEPTION 'Only the task creator can complete a task';
    END IF;
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Invalid status transition from % to %', OLD.status, NEW.status;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path TO public;

-- ── 3. Add completed_at timestamp column ──────────────────────────────────────
ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

-- ── 4. Auto-stamp completed_at on transition to 'completed' ───────────────────
CREATE OR REPLACE FUNCTION stamp_task_completed_at()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'completed' AND OLD.status IS DISTINCT FROM 'completed' THEN
    NEW.completed_at := NOW();
  END IF;
  -- Clear when moving back to in_progress from completed
  IF OLD.status = 'completed' AND NEW.status = 'in_progress' THEN
    NEW.completed_at := NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS task_completed_at_trigger ON tasks;
CREATE TRIGGER task_completed_at_trigger
  BEFORE UPDATE ON tasks
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION stamp_task_completed_at();

-- ── 5. Update audit log trigger to handle new status ──────────────────────────
-- The existing log_task_changes() trigger already logs any status change via
-- the generic status_change action — no changes needed there.

COMMENT ON COLUMN tasks.completed_at IS 'When the assignee marked the task as done (awaiting creator review)';
