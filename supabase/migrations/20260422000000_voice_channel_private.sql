-- ============================================================================
-- Private Voice Channels
-- Adds is_private flag and an allowlist (voice_channel_members) table.
-- Private channels are only visible to admins and explicitly added members.
-- ============================================================================

-- 1. Add is_private column
ALTER TABLE voice_channels
  ADD COLUMN IF NOT EXISTS is_private BOOLEAN NOT NULL DEFAULT FALSE;

-- 2. Allowlist table
CREATE TABLE IF NOT EXISTS voice_channel_members (
  channel_id UUID REFERENCES voice_channels(id) ON DELETE CASCADE,
  user_id    UUID REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY (channel_id, user_id)
);

CREATE INDEX idx_voice_channel_members_channel ON voice_channel_members(channel_id);
CREATE INDEX idx_voice_channel_members_user    ON voice_channel_members(user_id);

ALTER TABLE voice_channel_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage channel members"
ON voice_channel_members FOR ALL
TO authenticated
USING (is_admin((SELECT auth.uid())))
WITH CHECK (is_admin((SELECT auth.uid())));

CREATE POLICY "Users can view their own memberships"
ON voice_channel_members FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- 3. Update voice_channels SELECT policy to hide private channels
--    from non-members / non-admins.
DROP POLICY IF EXISTS "Authenticated users can view voice channels" ON voice_channels;

CREATE POLICY "Users can view accessible voice channels"
ON voice_channels FOR SELECT
TO authenticated
USING (
  is_private = FALSE
  OR
  is_admin((SELECT auth.uid()))
  OR
  EXISTS (
    SELECT 1 FROM voice_channel_members
    WHERE channel_id = voice_channels.id
      AND user_id = (SELECT auth.uid())
  )
);

-- 4. Enable realtime for member changes so channel list updates live
ALTER PUBLICATION supabase_realtime ADD TABLE voice_channel_members;
