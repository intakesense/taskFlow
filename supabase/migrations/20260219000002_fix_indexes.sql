-- ============================================================================
-- FIX: Unindexed Foreign Keys + Unused Index Cleanup
-- ============================================================================
--
-- Fixes two categories of Supabase INFO linter suggestions:
--
-- 1. unindexed_foreign_keys (9 warnings):
--    Foreign key columns without a covering index slow down JOINs and
--    cascading operations since Postgres must do a full table scan to find
--    matching rows on the referencing side.
--
-- 2. unused_index (11 warnings):
--    Indexes that have never been used waste storage and add overhead to
--    every INSERT/UPDATE/DELETE. Dropped where safe; retained where the
--    index purpose is clearly forward-looking (e.g. full-text search).
--
-- Reference: https://supabase.com/docs/guides/database/database-linter?lint=0001_unindexed_foreign_keys
-- ============================================================================


-- ============================================================================
-- SECTION 1: Add missing FK covering indexes
-- ============================================================================

-- ai_bot_config.updated_by → users.id
CREATE INDEX IF NOT EXISTS idx_ai_bot_config_updated_by
    ON public.ai_bot_config (updated_by);

-- app_settings.updated_by → users.id
CREATE INDEX IF NOT EXISTS idx_app_settings_updated_by
    ON public.app_settings (updated_by);

-- conversations.created_by → users.id
-- (frequent JOIN target in RLS + conversation list queries)
CREATE INDEX IF NOT EXISTS idx_conversations_created_by
    ON public.conversations (created_by);

-- meeting_minutes.voice_channel_id → voice_channels.id
CREATE INDEX IF NOT EXISTS idx_meeting_minutes_voice_channel_id
    ON public.meeting_minutes (voice_channel_id);

-- messages.reply_to_id → messages.id (self-referencing FK for threaded replies)
CREATE INDEX IF NOT EXISTS idx_messages_reply_to_id
    ON public.messages (reply_to_id)
    WHERE reply_to_id IS NOT NULL;   -- partial index: only rows that are replies

-- task_messages.sender_id → users.id
CREATE INDEX IF NOT EXISTS idx_task_messages_sender_id
    ON public.task_messages (sender_id);

-- task_notes.added_by → users.id
CREATE INDEX IF NOT EXISTS idx_task_notes_added_by
    ON public.task_notes (added_by);

-- typing_status.user_id → users.id
CREATE INDEX IF NOT EXISTS idx_typing_status_user_id
    ON public.typing_status (user_id);

-- voice_channels.created_by → users.id
CREATE INDEX IF NOT EXISTS idx_voice_channels_created_by
    ON public.voice_channels (created_by);


-- ============================================================================
-- SECTION 2: Drop provably unused indexes
-- ============================================================================
-- These indexes have never been used according to pg_stat_user_indexes.
-- Dropping them reduces write amplification on INSERT/UPDATE/DELETE with
-- zero impact on query performance (since they were never being used for reads).
--
-- NOTE: idx_users_onesignal_player_id is RETAINED — it supports the
-- push-notification player ID lookup which may be infrequent in dev but
-- will be hit in production on every notification dispatch.
--
-- NOTE: idx_tasks_status is RETAINED — filtering tasks by status is a
-- core query pattern (e.g. "show open tasks"). Likely unused in dev only.
--
-- NOTE: idx_messages_search is RETAINED — full-text search index. Unused
-- in dev because search hasn't been exercised, but critical for production.
-- ============================================================================

-- voice_channels: default ordering index — unused, ORDER BY covered by PK scan
DROP INDEX IF EXISTS public.idx_voice_channels_default;

-- voice_channel_sessions: channel + date range indexes — unused, data is sparse in dev
DROP INDEX IF EXISTS public.idx_voice_sessions_channel;
DROP INDEX IF EXISTS public.idx_voice_sessions_date;

-- task_messages: reply threading + file attachment lookup indexes — unused
-- (reply-to and file features exist but are rarely exercised in this app)
DROP INDEX IF EXISTS public.idx_task_messages_reply_to_id;
DROP INDEX IF EXISTS public.idx_task_messages_file_url;

-- users: reports_to hierarchy index — reports-to feature unused in current UI
DROP INDEX IF EXISTS public.idx_users_reports_to;

-- meeting_minutes: session + conversation lookup indexes — feature rarely used
DROP INDEX IF EXISTS public.idx_meeting_minutes_session;
DROP INDEX IF EXISTS public.idx_meeting_minutes_conversation;
