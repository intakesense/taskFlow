-- Migration: Add chat features to task_messages (reactions, replies, file attachments)
-- This brings task messages to feature parity with conversation messages

-- =====================================================
-- 1. Add new columns to task_messages table
-- =====================================================

-- Add file attachment fields (matching messages table structure)
ALTER TABLE task_messages
ADD COLUMN IF NOT EXISTS file_url TEXT,
ADD COLUMN IF NOT EXISTS file_name TEXT,
ADD COLUMN IF NOT EXISTS file_size BIGINT,
ADD COLUMN IF NOT EXISTS file_type TEXT;

-- Add reply support
ALTER TABLE task_messages
ADD COLUMN IF NOT EXISTS reply_to_id UUID REFERENCES task_messages(id) ON DELETE SET NULL;

-- Add soft delete support
ALTER TABLE task_messages
ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE;

-- Rename 'message' column to 'content' for consistency with messages table
-- First add the new column, copy data, then we'll handle the old column
ALTER TABLE task_messages
ADD COLUMN IF NOT EXISTS content TEXT;

-- Copy existing message data to content column
UPDATE task_messages SET content = message WHERE content IS NULL;

-- =====================================================
-- 2. Create task_message_reactions table
-- =====================================================

CREATE TABLE IF NOT EXISTS task_message_reactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id UUID NOT NULL REFERENCES task_messages(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    emoji TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),

    -- Ensure one reaction per emoji per user per message
    UNIQUE(message_id, user_id, emoji)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_task_message_reactions_message_id
ON task_message_reactions(message_id);

CREATE INDEX IF NOT EXISTS idx_task_message_reactions_user_id
ON task_message_reactions(user_id);

-- =====================================================
-- 3. Enable realtime for new table
-- =====================================================

ALTER PUBLICATION supabase_realtime ADD TABLE task_message_reactions;

-- =====================================================
-- 4. RLS Policies for task_message_reactions
-- =====================================================

ALTER TABLE task_message_reactions ENABLE ROW LEVEL SECURITY;

-- Users can view reactions on messages they can see (task participants)
CREATE POLICY "Users can view reactions on accessible task messages"
ON task_message_reactions FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM task_messages tm
        JOIN tasks t ON tm.task_id = t.id
        WHERE tm.id = task_message_reactions.message_id
        AND (
            -- User is the task assigner
            t.assigned_by = auth.uid()
            -- OR user is assigned to the task
            OR EXISTS (
                SELECT 1 FROM task_assignees ta
                WHERE ta.task_id = t.id AND ta.user_id = auth.uid()
            )
            -- OR user is admin
            OR EXISTS (
                SELECT 1 FROM users WHERE id = auth.uid() AND is_admin = true
            )
        )
    )
);

-- Users can add reactions to messages they can see
CREATE POLICY "Users can add reactions to accessible task messages"
ON task_message_reactions FOR INSERT
WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
        SELECT 1 FROM task_messages tm
        JOIN tasks t ON tm.task_id = t.id
        WHERE tm.id = task_message_reactions.message_id
        AND (
            t.assigned_by = auth.uid()
            OR EXISTS (
                SELECT 1 FROM task_assignees ta
                WHERE ta.task_id = t.id AND ta.user_id = auth.uid()
            )
            OR EXISTS (
                SELECT 1 FROM users WHERE id = auth.uid() AND is_admin = true
            )
        )
    )
);

-- Users can delete their own reactions
CREATE POLICY "Users can delete own reactions"
ON task_message_reactions FOR DELETE
USING (auth.uid() = user_id);

-- =====================================================
-- 5. Update task_messages RLS policies if needed
-- =====================================================

-- Add index on reply_to_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_task_messages_reply_to_id
ON task_messages(reply_to_id) WHERE reply_to_id IS NOT NULL;

-- Add index on file_url for file message queries
CREATE INDEX IF NOT EXISTS idx_task_messages_file_url
ON task_messages(file_url) WHERE file_url IS NOT NULL;