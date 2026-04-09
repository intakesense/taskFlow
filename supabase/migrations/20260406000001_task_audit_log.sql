-- Migration: Task Audit Log
--
-- Creates an audit trail for task changes, tracking:
-- - Status changes (with old/new status and reason)
-- - Field updates (title, description, deadline, priority)
-- - Assignee changes
--
-- This provides accountability and enables debugging "who changed what, when"

-- Create the audit log table
CREATE TABLE task_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id),
  action VARCHAR(50) NOT NULL CHECK (action IN ('status_change', 'field_update', 'assignee_add', 'assignee_remove', 'created', 'deleted')),
  old_value JSONB,
  new_value JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast lookups by task
CREATE INDEX idx_task_audit_log_task_id ON task_audit_log(task_id, created_at DESC);

-- Index for user activity queries
CREATE INDEX idx_task_audit_log_user_id ON task_audit_log(user_id, created_at DESC);

-- Enable RLS
ALTER TABLE task_audit_log ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Task participants can view audit log
CREATE POLICY "Task participants can view audit log"
ON task_audit_log FOR SELECT
TO authenticated
USING (
  is_task_creator(task_id, auth.uid())
  OR is_task_assignee(task_id, auth.uid())
  OR is_admin_user(auth.uid())
);

-- Trigger function to auto-log task changes
CREATE OR REPLACE FUNCTION log_task_changes()
RETURNS TRIGGER AS $$
BEGIN
  -- Log status changes
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO task_audit_log (task_id, user_id, action, old_value, new_value)
    VALUES (
      NEW.id,
      auth.uid(),
      'status_change',
      jsonb_build_object('status', OLD.status, 'on_hold_reason', OLD.on_hold_reason),
      jsonb_build_object('status', NEW.status, 'on_hold_reason', NEW.on_hold_reason)
    );
  END IF;

  -- Log title changes
  IF OLD.title IS DISTINCT FROM NEW.title THEN
    INSERT INTO task_audit_log (task_id, user_id, action, old_value, new_value)
    VALUES (
      NEW.id,
      auth.uid(),
      'field_update',
      jsonb_build_object('field', 'title', 'value', OLD.title),
      jsonb_build_object('field', 'title', 'value', NEW.title)
    );
  END IF;

  -- Log description changes
  IF OLD.description IS DISTINCT FROM NEW.description THEN
    INSERT INTO task_audit_log (task_id, user_id, action, old_value, new_value)
    VALUES (
      NEW.id,
      auth.uid(),
      'field_update',
      jsonb_build_object('field', 'description', 'value', LEFT(OLD.description, 100)),
      jsonb_build_object('field', 'description', 'value', LEFT(NEW.description, 100))
    );
  END IF;

  -- Log deadline changes
  IF OLD.deadline IS DISTINCT FROM NEW.deadline THEN
    INSERT INTO task_audit_log (task_id, user_id, action, old_value, new_value)
    VALUES (
      NEW.id,
      auth.uid(),
      'field_update',
      jsonb_build_object('field', 'deadline', 'value', OLD.deadline),
      jsonb_build_object('field', 'deadline', 'value', NEW.deadline)
    );
  END IF;

  -- Log priority changes
  IF OLD.priority IS DISTINCT FROM NEW.priority THEN
    INSERT INTO task_audit_log (task_id, user_id, action, old_value, new_value)
    VALUES (
      NEW.id,
      auth.uid(),
      'field_update',
      jsonb_build_object('field', 'priority', 'value', OLD.priority),
      jsonb_build_object('field', 'priority', 'value', NEW.priority)
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path TO public;

-- Create the trigger (runs AFTER update so it doesn't interfere with validation/timestamp triggers)
DROP TRIGGER IF EXISTS task_audit_trigger ON tasks;

CREATE TRIGGER task_audit_trigger
  AFTER UPDATE ON tasks
  FOR EACH ROW
  EXECUTE FUNCTION log_task_changes();

-- Trigger function to log task creation
CREATE OR REPLACE FUNCTION log_task_creation()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO task_audit_log (task_id, user_id, action, new_value)
  VALUES (
    NEW.id,
    auth.uid(),
    'created',
    jsonb_build_object(
      'title', NEW.title,
      'status', NEW.status,
      'priority', NEW.priority
    )
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path TO public;

DROP TRIGGER IF EXISTS task_audit_creation_trigger ON tasks;

CREATE TRIGGER task_audit_creation_trigger
  AFTER INSERT ON tasks
  FOR EACH ROW
  EXECUTE FUNCTION log_task_creation();

-- Trigger function to log assignee changes
CREATE OR REPLACE FUNCTION log_task_assignee_changes()
RETURNS TRIGGER AS $$
DECLARE
  v_user_name TEXT;
BEGIN
  -- Get the assignee's name for the log
  SELECT name INTO v_user_name FROM users WHERE id = COALESCE(NEW.user_id, OLD.user_id);

  IF TG_OP = 'INSERT' THEN
    INSERT INTO task_audit_log (task_id, user_id, action, new_value)
    VALUES (
      NEW.task_id,
      auth.uid(),
      'assignee_add',
      jsonb_build_object('user_id', NEW.user_id, 'user_name', v_user_name)
    );
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO task_audit_log (task_id, user_id, action, old_value)
    VALUES (
      OLD.task_id,
      auth.uid(),
      'assignee_remove',
      jsonb_build_object('user_id', OLD.user_id, 'user_name', v_user_name)
    );
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path TO public;

DROP TRIGGER IF EXISTS task_assignee_audit_trigger ON task_assignees;

CREATE TRIGGER task_assignee_audit_trigger
  AFTER INSERT OR DELETE ON task_assignees
  FOR EACH ROW
  EXECUTE FUNCTION log_task_assignee_changes();

-- Add comment for documentation
COMMENT ON TABLE task_audit_log IS 'Audit trail for task changes - tracks who changed what and when';
