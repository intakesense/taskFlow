-- Add OneSignal player_id column for push notifications
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS onesignal_player_id text;

-- Index for faster lookups when sending notifications
CREATE INDEX IF NOT EXISTS idx_users_onesignal_player_id
ON public.users(onesignal_player_id)
WHERE onesignal_player_id IS NOT NULL;

COMMENT ON COLUMN public.users.onesignal_player_id IS 'OneSignal player ID for push notifications';
