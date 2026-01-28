-- ============================================================================
-- VOICE CHANNELS SCHEMA
-- Implements Discord-like voice channel functionality for TaskFlow
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Helper function for updated_at trigger (if not exists)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ----------------------------------------------------------------------------
-- Voice Channels Table
-- Stores voice channel metadata (single "ChitChat" channel for MVP)
-- ----------------------------------------------------------------------------
CREATE TABLE voice_channels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    is_default BOOLEAN DEFAULT FALSE,
    max_participants INT DEFAULT 25,
    -- Daily.co room configuration
    daily_room_name TEXT UNIQUE,
    daily_room_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for quick default channel lookup
CREATE INDEX idx_voice_channels_default ON voice_channels(is_default) WHERE is_default = TRUE;

-- Updated_at trigger
CREATE TRIGGER update_voice_channels_updated_at
    BEFORE UPDATE ON voice_channels
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ----------------------------------------------------------------------------
-- Voice Channel Participants Table
-- Tracks who is currently in each voice channel with their state
-- ----------------------------------------------------------------------------
CREATE TABLE voice_channel_participants (
    channel_id UUID REFERENCES voice_channels(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    joined_at TIMESTAMPTZ DEFAULT NOW(),

    -- Participant state (synced from Daily for UI display)
    is_muted BOOLEAN DEFAULT FALSE,
    is_video_on BOOLEAN DEFAULT FALSE,
    is_screen_sharing BOOLEAN DEFAULT FALSE,
    is_speaking BOOLEAN DEFAULT FALSE,

    -- Connection quality (optional, for UI indicators)
    connection_quality TEXT DEFAULT 'good' CHECK (connection_quality IN ('excellent', 'good', 'poor', 'lost')),

    PRIMARY KEY (channel_id, user_id)
);

-- Index for channel participant lookups
CREATE INDEX idx_voice_participants_channel ON voice_channel_participants(channel_id);
CREATE INDEX idx_voice_participants_user ON voice_channel_participants(user_id);

-- ----------------------------------------------------------------------------
-- Voice Channel Sessions Table (Optional - for analytics/history)
-- Logs voice channel usage for analytics
-- ----------------------------------------------------------------------------
CREATE TABLE voice_channel_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    channel_id UUID REFERENCES voice_channels(id) ON DELETE SET NULL,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    joined_at TIMESTAMPTZ NOT NULL,
    left_at TIMESTAMPTZ
);

-- Index for session history queries
CREATE INDEX idx_voice_sessions_user ON voice_channel_sessions(user_id);
CREATE INDEX idx_voice_sessions_channel ON voice_channel_sessions(channel_id);
CREATE INDEX idx_voice_sessions_date ON voice_channel_sessions(joined_at);

-- ----------------------------------------------------------------------------
-- Enable Realtime for participant tracking
-- ----------------------------------------------------------------------------
ALTER PUBLICATION supabase_realtime ADD TABLE voice_channel_participants;

-- ----------------------------------------------------------------------------
-- Row Level Security Policies
-- ----------------------------------------------------------------------------

-- Voice Channels: All authenticated users can view
ALTER TABLE voice_channels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view voice channels"
ON voice_channels FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Admins can manage voice channels"
ON voice_channels FOR ALL
TO authenticated
USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND is_admin = true)
);

-- Voice Channel Participants: All authenticated users can view, manage own
ALTER TABLE voice_channel_participants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view participants"
ON voice_channel_participants FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Users can join channels (insert own record)"
ON voice_channel_participants FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own participation state"
ON voice_channel_participants FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can leave channels (delete own record)"
ON voice_channel_participants FOR DELETE
TO authenticated
USING (user_id = auth.uid());

-- Voice Channel Sessions: Users can view own, admins can view all
ALTER TABLE voice_channel_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own session history"
ON voice_channel_sessions FOR SELECT
TO authenticated
USING (
    user_id = auth.uid() OR
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND is_admin = true)
);

CREATE POLICY "System can create sessions"
ON voice_channel_sessions FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "System can update sessions"
ON voice_channel_sessions FOR UPDATE
TO authenticated
USING (user_id = auth.uid());

-- ----------------------------------------------------------------------------
-- Seed default ChitChat channel
-- ----------------------------------------------------------------------------
INSERT INTO voice_channels (name, description, is_default, daily_room_name)
VALUES (
    'ChitChat',
    'General voice channel for team discussions. Jump in anytime!',
    true,
    'taskflow-chitchat'
);

-- ----------------------------------------------------------------------------
-- Helper Functions
-- ----------------------------------------------------------------------------

-- Get participant count for a channel
CREATE OR REPLACE FUNCTION get_voice_channel_participant_count(p_channel_id UUID)
RETURNS INT
LANGUAGE SQL
STABLE
AS $$
    SELECT COUNT(*)::INT
    FROM voice_channel_participants
    WHERE channel_id = p_channel_id;
$$;

-- Get default voice channel ID
CREATE OR REPLACE FUNCTION get_default_voice_channel_id()
RETURNS UUID
LANGUAGE SQL
STABLE
AS $$
    SELECT id FROM voice_channels WHERE is_default = TRUE LIMIT 1;
$$;

-- Clean up stale participants (for cron job - users who disconnected unexpectedly)
CREATE OR REPLACE FUNCTION cleanup_stale_voice_participants()
RETURNS INT
LANGUAGE plpgsql
AS $$
DECLARE
    deleted_count INT;
BEGIN
    DELETE FROM voice_channel_participants
    WHERE joined_at < NOW() - INTERVAL '24 hours';

    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$;
