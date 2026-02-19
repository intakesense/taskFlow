-- AI Bot Schema Migration
-- Creates tables for AI bot configuration, sessions, and meeting minutes

-- AI Bot configuration (admin-configurable)
CREATE TABLE ai_bot_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL DEFAULT 'Bot',
    avatar_url TEXT DEFAULT '/images/ai-bot-avatar.png',
    voice TEXT DEFAULT 'alloy',
    is_enabled BOOLEAN DEFAULT TRUE,
    trigger_phrases TEXT[] DEFAULT ARRAY['Bot', 'Hey Bot'],
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    updated_by UUID REFERENCES users(id)
);

-- Insert default config
INSERT INTO ai_bot_config (name) VALUES ('Bot');

-- Generate a fixed UUID for the bot user
-- First, insert into auth.users (required due to foreign key constraint)
-- Then insert into public.users
DO $$
DECLARE
    bot_user_id UUID := '00000000-0000-0000-0000-000000000001';
BEGIN
    -- Insert into auth.users first (bot is a system user, not a real auth user)
    INSERT INTO auth.users (
        id,
        instance_id,
        aud,
        role,
        email,
        encrypted_password,
        email_confirmed_at,
        created_at,
        updated_at,
        confirmation_token,
        recovery_token
    )
    VALUES (
        bot_user_id,
        '00000000-0000-0000-0000-000000000000',
        'authenticated',
        'authenticated',
        'bot@taskflow.local',
        '', -- No password - bot cannot login
        NOW(),
        NOW(),
        NOW(),
        '',
        ''
    )
    ON CONFLICT (id) DO NOTHING;

    -- Add bot user to public.users table
    INSERT INTO users (id, email, name, level, is_admin, avatar_url)
    VALUES (
        bot_user_id,
        'bot@taskflow.local',
        'Bot',
        1,
        false,
        '/images/ai-bot-avatar.png'
    )
    ON CONFLICT (id) DO NOTHING;
END $$;

-- AI Sessions (tracks when bot is in a voice channel)
CREATE TABLE ai_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    voice_channel_id UUID REFERENCES voice_channels(id) ON DELETE CASCADE,
    transcript JSONB DEFAULT '[]',
    status TEXT CHECK (status IN ('active', 'ended', 'processing')) DEFAULT 'active',
    started_at TIMESTAMPTZ DEFAULT NOW(),
    ended_at TIMESTAMPTZ
);

-- Meeting minutes storage
CREATE TABLE meeting_minutes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID REFERENCES ai_sessions(id) ON DELETE CASCADE,
    conversation_id UUID REFERENCES conversations(id) ON DELETE SET NULL,
    voice_channel_id UUID REFERENCES voice_channels(id) ON DELETE SET NULL,
    attendees JSONB NOT NULL DEFAULT '[]',
    duration_minutes INT,
    summary TEXT,
    discussion_points JSONB DEFAULT '[]',
    action_items JSONB DEFAULT '[]',
    decisions JSONB DEFAULT '[]',
    raw_transcript TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_ai_sessions_voice_channel ON ai_sessions(voice_channel_id);
CREATE INDEX idx_ai_sessions_status ON ai_sessions(status);
CREATE INDEX idx_meeting_minutes_session ON meeting_minutes(session_id);
CREATE INDEX idx_meeting_minutes_conversation ON meeting_minutes(conversation_id);

-- Enable RLS
ALTER TABLE ai_bot_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE meeting_minutes ENABLE ROW LEVEL SECURITY;

-- RLS Policies for ai_bot_config
-- Everyone can read
CREATE POLICY "Anyone can read ai_bot_config"
ON ai_bot_config FOR SELECT
TO authenticated
USING (true);

-- Only admins can update
CREATE POLICY "Admins can update ai_bot_config"
ON ai_bot_config FOR UPDATE
TO authenticated
USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND is_admin = true));

-- RLS Policies for ai_sessions
-- Everyone can read
CREATE POLICY "Anyone can read ai_sessions"
ON ai_sessions FOR SELECT
TO authenticated
USING (true);

-- System can insert/update (via service role)
CREATE POLICY "Service role can manage ai_sessions"
ON ai_sessions FOR ALL
TO service_role
USING (true);

-- RLS Policies for meeting_minutes
-- Anyone can read meeting minutes
CREATE POLICY "Anyone can read meeting_minutes"
ON meeting_minutes FOR SELECT
TO authenticated
USING (true);

-- Service role can insert
CREATE POLICY "Service role can manage meeting_minutes"
ON meeting_minutes FOR ALL
TO service_role
USING (true);

-- Enable realtime for ai_sessions so we can track bot presence
ALTER PUBLICATION supabase_realtime ADD TABLE ai_sessions;

-- Add comment explaining the bot user ID
COMMENT ON TABLE ai_bot_config IS 'AI Bot configuration, editable by admins. Bot user ID is 00000000-0000-0000-0000-000000000001';