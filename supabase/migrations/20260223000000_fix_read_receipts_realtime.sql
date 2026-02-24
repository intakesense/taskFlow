-- ============================================================================
-- Fix Read Receipts Real-time Updates
-- ============================================================================
-- Problem: Read receipt ticks don't update in real-time because
-- conversation_members table is not in the Supabase realtime publication.
--
-- When User B reads User A's message:
-- 1. User B's client updates conversation_members.last_read_at
-- 2. User A's client subscribes to conversation_members changes
-- 3. BUT Supabase never sends the event because table isn't published
--
-- This migration adds conversation_members to the realtime publication.
-- ============================================================================

-- Add conversation_members to realtime publication for read receipt updates
-- This enables real-time sync of last_read_at changes across clients
ALTER PUBLICATION supabase_realtime ADD TABLE conversation_members;

-- ============================================================================
-- Note: The message_reads table is already in the publication but unused.
-- The codebase uses conversation_members.last_read_at for read tracking.
-- This is simpler (one timestamp per user per conversation) vs per-message.
-- ============================================================================