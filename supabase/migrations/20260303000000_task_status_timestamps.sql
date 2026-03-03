-- Add status change timestamps to tasks table
-- These track when a task entered its current status for time-in-status display

-- Add new columns
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS on_hold_at TIMESTAMPTZ;

-- Create or replace the trigger function
CREATE OR REPLACE FUNCTION update_task_status_timestamps()
RETURNS TRIGGER AS $$
BEGIN
  -- Only process if status actually changed
  IF OLD.status IS DISTINCT FROM NEW.status THEN

    -- Status changed to in_progress
    IF NEW.status = 'in_progress' THEN
      NEW.started_at = NOW();
      NEW.on_hold_at = NULL;
    END IF;

    -- Status changed to on_hold
    IF NEW.status = 'on_hold' THEN
      NEW.on_hold_at = NOW();
      -- Keep started_at to track when work began
    END IF;

    -- Status changed to archived (completed)
    IF NEW.status = 'archived' THEN
      NEW.archived_at = NOW();
    END IF;

    -- Status changed back to pending (reset all)
    IF NEW.status = 'pending' THEN
      NEW.started_at = NULL;
      NEW.on_hold_at = NULL;
      NEW.archived_at = NULL;
    END IF;

  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create the trigger (drop first if exists to avoid duplicates)
DROP TRIGGER IF EXISTS task_status_timestamps_trigger ON tasks;

CREATE TRIGGER task_status_timestamps_trigger
  BEFORE UPDATE ON tasks
  FOR EACH ROW
  EXECUTE FUNCTION update_task_status_timestamps();

-- Add comment for documentation
COMMENT ON COLUMN tasks.started_at IS 'Timestamp when task was moved to in_progress status';
COMMENT ON COLUMN tasks.on_hold_at IS 'Timestamp when task was moved to on_hold status';
