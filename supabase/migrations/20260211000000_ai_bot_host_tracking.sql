-- Add host tracking to ai_sessions
-- The host_user_id tracks which user activated/is hosting the bot

ALTER TABLE ai_sessions
ADD COLUMN host_user_id UUID REFERENCES users(id);

-- Add index for faster lookups
CREATE INDEX idx_ai_sessions_host ON ai_sessions(host_user_id);

-- Update RLS to allow authenticated users to insert sessions (when they activate the bot)
CREATE POLICY "Authenticated users can insert ai_sessions"
ON ai_sessions FOR INSERT
TO authenticated
WITH CHECK (true);

-- Allow host to update their own session
CREATE POLICY "Host can update their ai_session"
ON ai_sessions FOR UPDATE
TO authenticated
USING (host_user_id = auth.uid());

-- Comment
COMMENT ON COLUMN ai_sessions.host_user_id IS 'The user who activated/is hosting the bot in this session';