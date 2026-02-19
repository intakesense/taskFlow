-- ============================================================================
-- FIX: Remaining Unindexed Foreign Keys
-- ============================================================================
--
-- Adds covering indexes for FK columns missed in the previous migration.
-- Note: meeting_minutes.session_id and meeting_minutes.conversation_id
-- previously had indexes (idx_meeting_minutes_session and
-- idx_meeting_minutes_conversation) that were dropped as "unused" in
-- migration 20260219000002 — but they were actually the FK covering indexes.
-- Recreating them here with explicit FK-aligned names.
--
-- Reference: https://supabase.com/docs/guides/database/database-linter?lint=0001_unindexed_foreign_keys
-- ============================================================================

-- meeting_minutes.session_id → ai_sessions.id
CREATE INDEX IF NOT EXISTS idx_meeting_minutes_session_id
    ON public.meeting_minutes (session_id);

-- meeting_minutes.conversation_id → conversations.id
CREATE INDEX IF NOT EXISTS idx_meeting_minutes_conversation_id
    ON public.meeting_minutes (conversation_id);

-- task_messages.reply_to_id → task_messages.id (self-referencing, reply threading)
CREATE INDEX IF NOT EXISTS idx_task_messages_reply_to_id
    ON public.task_messages (reply_to_id)
    WHERE reply_to_id IS NOT NULL;  -- partial index: only rows that are replies

-- users.reports_to → users.id (self-referencing, org hierarchy)
CREATE INDEX IF NOT EXISTS idx_users_reports_to
    ON public.users (reports_to)
    WHERE reports_to IS NOT NULL;   -- partial index: only non-root users

-- voice_channel_sessions.channel_id → voice_channels.id
CREATE INDEX IF NOT EXISTS idx_voice_channel_sessions_channel_id
    ON public.voice_channel_sessions (channel_id);
