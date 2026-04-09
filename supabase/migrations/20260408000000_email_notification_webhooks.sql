-- Email notification webhooks
-- These webhooks call the notify-email edge function to send emails via Resend
-- when tasks are assigned or their status changes.
--
-- SETUP REQUIRED: Configure these in Supabase Dashboard → Database → Webhooks
-- after deploying the notify-email edge function.
--
-- Required environment variables in Supabase Dashboard → Edge Functions → notify-email:
--   RESEND_API_KEY         - Your Resend API key (from resend.com/api-keys)
--   EMAIL_FROM             - From address, e.g. "TaskFlow <notifications@yourdomain.com>"
--   NEXT_PUBLIC_APP_URL    - Your app URL, e.g. "https://app.yourdomain.com"

-- Webhook 1: Email on task assignment
-- Name:   email_task_assignment
-- Table:  task_assignees
-- Events: INSERT
-- URL:    https://<project-ref>.supabase.co/functions/v1/notify-email
-- Headers:
--   Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>
--   Content-Type:  application/json

-- Webhook 2: Email on task status change
-- Name:   email_task_status_change
-- Table:  tasks
-- Events: UPDATE
-- URL:    https://<project-ref>.supabase.co/functions/v1/notify-email
-- Headers:
--   Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>
--   Content-Type:  application/json

-- Email transitions that trigger notifications (handled in the edge function):
--   pending      → in_progress  (task started)
--   in_progress  → on_hold      (task paused, includes reason)
--   in_progress  → archived     (task completed)
--   on_hold      → in_progress  (task resumed)
--   archived     → in_progress  (task reopened)

SELECT 1;
