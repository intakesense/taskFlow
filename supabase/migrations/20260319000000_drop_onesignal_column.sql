-- Drop deprecated OneSignal column (replaced by device_tokens table with FCM)

-- Drop the index first
DROP INDEX IF EXISTS idx_users_onesignal_player_id;

-- Drop the column
ALTER TABLE public.users DROP COLUMN IF EXISTS onesignal_player_id;
