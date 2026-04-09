-- Migration: Add device_tokens table for mobile/desktop push notifications
-- This enables native push notifications for React Native (iOS/Android) and
-- Tauri desktop apps, bypassing PWA limitations.

-- Create the device_tokens table
CREATE TABLE IF NOT EXISTS device_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token TEXT NOT NULL,
    platform TEXT NOT NULL CHECK (platform IN ('ios', 'android', 'web', 'desktop')),
    device_name TEXT,
    app_version TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_used_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- Prevent duplicate tokens per user
    UNIQUE(user_id, token)
);

-- Index for efficient lookups when sending notifications
CREATE INDEX IF NOT EXISTS idx_device_tokens_user_id ON device_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_device_tokens_platform ON device_tokens(platform);

-- Enable Row Level Security
ALTER TABLE device_tokens ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can only manage their own device tokens
CREATE POLICY "Users can view own device tokens"
ON device_tokens FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own device tokens"
ON device_tokens FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own device tokens"
ON device_tokens FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own device tokens"
ON device_tokens FOR DELETE
USING (auth.uid() = user_id);

-- Function to update last_used_at timestamp
CREATE OR REPLACE FUNCTION update_device_token_last_used()
RETURNS TRIGGER AS $$
BEGIN
    NEW.last_used_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update last_used_at on token refresh
CREATE TRIGGER trigger_update_device_token_last_used
    BEFORE UPDATE ON device_tokens
    FOR EACH ROW
    EXECUTE FUNCTION update_device_token_last_used();

-- Comment for documentation
COMMENT ON TABLE device_tokens IS 'Stores push notification tokens for mobile (FCM/APNs) and desktop apps';
COMMENT ON COLUMN device_tokens.platform IS 'Device platform: ios, android, web (all use FCM), desktop (Tauri uses realtime)';
COMMENT ON COLUMN device_tokens.token IS 'FCM registration token (Android), APNs device token (iOS), or empty for desktop (uses realtime)';
