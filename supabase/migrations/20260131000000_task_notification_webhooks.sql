-- Task notification webhooks
-- These webhooks call the notify-tasks edge function when tasks are assigned or updated

-- Note: Supabase webhooks are configured in the Supabase Dashboard under Database > Webhooks
-- This migration documents what needs to be set up:

-- Webhook 1: Task Assignment Notification
-- Name: notify_task_assignment
-- Table: task_assignees
-- Events: INSERT
-- URL: https://<project-ref>.supabase.co/functions/v1/notify-tasks
-- Headers: Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>

-- Webhook 2: Task Status Change Notification  
-- Name: notify_task_status_change
-- Table: tasks
-- Events: UPDATE
-- URL: https://<project-ref>.supabase.co/functions/v1/notify-tasks
-- Headers: Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>

-- IMPORTANT: After running this migration, configure the webhooks in Supabase Dashboard:
-- 1. Go to Database > Webhooks
-- 2. Create the two webhooks above
-- 3. Make sure to include the Authorization header

-- This is a placeholder migration to document the required webhook configuration
SELECT 1;
