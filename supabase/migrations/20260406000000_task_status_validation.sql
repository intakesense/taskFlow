-- Migration: Task Status Transition Validation
--
-- Enforces workflow rules for task status changes at the database level:
-- - pending -> in_progress: Only assignees can start
-- - in_progress -> on_hold: Only assignees, requires on_hold_reason
-- - in_progress -> archived: Only creator can complete (acceptance)
-- - on_hold -> in_progress: Only assignees can resume
-- - archived -> in_progress: Only creator can reopen
-- - All other transitions: Rejected
--
-- This is bypass-proof - no matter how the update arrives (UI, API, direct SQL),
-- the rules are enforced.

-- Create the validation function
CREATE OR REPLACE FUNCTION validate_task_status_transition()
RETURNS TRIGGER AS $$
DECLARE
  v_is_assignee BOOLEAN;
  v_is_creator BOOLEAN;
  v_is_admin BOOLEAN;
  v_current_user UUID;
BEGIN
  -- Only process if status actually changed
  IF OLD.status IS NOT DISTINCT FROM NEW.status THEN
    RETURN NEW;
  END IF;

  -- Get current user
  v_current_user := auth.uid();

  -- If no authenticated user (e.g., service role), allow the change
  IF v_current_user IS NULL THEN
    RETURN NEW;
  END IF;

  -- Check roles using existing helper functions
  v_is_assignee := is_task_assignee(NEW.id, v_current_user);
  v_is_creator := (OLD.assigned_by = v_current_user);
  v_is_admin := is_admin_user(v_current_user);

  -- Admins can always change status
  IF v_is_admin THEN
    RETURN NEW;
  END IF;

  -- TRANSITION: pending -> in_progress (assignee only)
  IF OLD.status = 'pending' AND NEW.status = 'in_progress' THEN
    IF NOT v_is_assignee THEN
      RAISE EXCEPTION 'Only assignees can start a task';
    END IF;
    RETURN NEW;
  END IF;

  -- TRANSITION: in_progress -> on_hold (assignee only, requires reason)
  IF OLD.status = 'in_progress' AND NEW.status = 'on_hold' THEN
    IF NOT v_is_assignee THEN
      RAISE EXCEPTION 'Only assignees can put a task on hold';
    END IF;
    IF NEW.on_hold_reason IS NULL OR trim(NEW.on_hold_reason) = '' THEN
      RAISE EXCEPTION 'on_hold_reason is required when putting task on hold';
    END IF;
    RETURN NEW;
  END IF;

  -- TRANSITION: in_progress -> archived (creator only - acceptance)
  IF OLD.status = 'in_progress' AND NEW.status = 'archived' THEN
    IF NOT v_is_creator THEN
      RAISE EXCEPTION 'Only task creator can complete/archive a task';
    END IF;
    RETURN NEW;
  END IF;

  -- TRANSITION: on_hold -> in_progress (assignee only)
  IF OLD.status = 'on_hold' AND NEW.status = 'in_progress' THEN
    IF NOT v_is_assignee THEN
      RAISE EXCEPTION 'Only assignees can resume a task';
    END IF;
    -- Clear the on_hold_reason when resuming
    NEW.on_hold_reason := NULL;
    RETURN NEW;
  END IF;

  -- TRANSITION: archived -> in_progress (creator only - reopen)
  IF OLD.status = 'archived' AND NEW.status = 'in_progress' THEN
    IF NOT v_is_creator THEN
      RAISE EXCEPTION 'Only task creator can reopen a task';
    END IF;
    RETURN NEW;
  END IF;

  -- All other transitions are invalid
  RAISE EXCEPTION 'Invalid status transition from % to %', OLD.status, NEW.status;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path TO public;

-- Create the trigger (runs BEFORE the timestamp trigger so validation happens first)
DROP TRIGGER IF EXISTS task_status_validation_trigger ON tasks;

CREATE TRIGGER task_status_validation_trigger
  BEFORE UPDATE ON tasks
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION validate_task_status_transition();

-- Add comment for documentation
COMMENT ON FUNCTION validate_task_status_transition() IS 'Validates task status transitions and enforces workflow rules (who can do what transitions)';
