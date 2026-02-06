-- ============================================================================
-- GROUP MANAGEMENT FEATURES
-- Enables group members to manage group settings (name, avatar) like WhatsApp
-- Only the group creator can add/remove members
-- ============================================================================

-- ----------------------------------------------------------------------------
-- RLS Policies for group management
-- ----------------------------------------------------------------------------

-- Allow any group member to update conversation details (name, avatar) - like WhatsApp
DROP POLICY IF EXISTS "Group members can update conversation" ON conversations;
CREATE POLICY "Group members can update conversation"
ON conversations FOR UPDATE
TO authenticated
USING (
    is_group = TRUE
    AND EXISTS (
        SELECT 1 FROM conversation_members
        WHERE conversation_members.conversation_id = conversations.id
        AND conversation_members.user_id = auth.uid()
    )
)
WITH CHECK (
    is_group = TRUE
    AND EXISTS (
        SELECT 1 FROM conversation_members
        WHERE conversation_members.conversation_id = conversations.id
        AND conversation_members.user_id = auth.uid()
    )
);

-- Allow group creator to add members
DROP POLICY IF EXISTS "Group creator can add members" ON conversation_members;
CREATE POLICY "Group creator can add members"
ON conversation_members FOR INSERT
TO authenticated
WITH CHECK (
    -- User is the creator of the group
    EXISTS (
        SELECT 1 FROM conversations c
        WHERE c.id = conversation_members.conversation_id
        AND c.created_by = auth.uid()
        AND c.is_group = TRUE
    )
    -- Or user is adding themselves to a DM/group they were invited to (handled by app)
    OR conversation_members.user_id = auth.uid()
);

-- Allow group creator to remove members, or users to leave themselves
DROP POLICY IF EXISTS "Group creator can remove members" ON conversation_members;
CREATE POLICY "Group creator can remove members"
ON conversation_members FOR DELETE
TO authenticated
USING (
    -- User is the creator of the group
    EXISTS (
        SELECT 1 FROM conversations c
        WHERE c.id = conversation_members.conversation_id
        AND c.created_by = auth.uid()
        AND c.is_group = TRUE
    )
    -- Or user is leaving the conversation themselves
    OR conversation_members.user_id = auth.uid()
);

-- ----------------------------------------------------------------------------
-- Helper Function: Check if user is group creator
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION is_group_creator(p_conversation_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
AS $$
    SELECT EXISTS (
        SELECT 1 FROM conversations
        WHERE id = p_conversation_id
        AND created_by = p_user_id
        AND is_group = TRUE
    );
$$;

-- ----------------------------------------------------------------------------
-- Helper Function: Check if user is group member
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION is_group_member(p_conversation_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
AS $$
    SELECT EXISTS (
        SELECT 1 FROM conversation_members
        WHERE conversation_id = p_conversation_id
        AND user_id = p_user_id
    );
$$;
