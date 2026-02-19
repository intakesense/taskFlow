-- ============================================================================
-- FIX: Auth RLS Initialization Plan + Multiple Permissive Policies
-- ============================================================================
--
-- Fixes two categories of Supabase linter warnings:
--
-- 1. auth_rls_initplan (35 warnings):
--    auth.uid() called bare in policy expressions is re-evaluated once per
--    row. Wrapping with (SELECT auth.uid()) lets Postgres evaluate it once
--    per statement and cache the result.
--
-- 2. multiple_permissive_policies (14 warnings):
--    Tables that have two permissive policies covering the same role+action
--    cause Postgres to evaluate BOTH for every query. Merging them into one
--    policy with OR eliminates the redundant evaluation.
--
-- Reference: https://supabase.com/docs/guides/database/postgres/row-level-security#call-functions-with-select
-- ============================================================================


-- ============================================================================
-- SECTION 1: public.conversations
-- Fixes:
--   auth_rls_initplan - "Authenticated users can create conversations"
--   auth_rls_initplan - "Members can view conversations"
--   auth_rls_initplan - "Admins and creators can update conversations"
--   auth_rls_initplan - "Group members can update conversation"
--   multiple_permissive_policies - authenticated UPDATE
--     ("Admins and creators can update conversations" + "Group members can update conversation")
-- ============================================================================

DROP POLICY IF EXISTS "Authenticated users can create conversations" ON public.conversations;
DROP POLICY IF EXISTS "Users can create conversations"               ON public.conversations;
DROP POLICY IF EXISTS "Members can view conversations"              ON public.conversations;
DROP POLICY IF EXISTS "Admins and creators can update conversations" ON public.conversations;
DROP POLICY IF EXISTS "Group members can update conversation"        ON public.conversations;

-- INSERT: authenticated user creating their own conversation
CREATE POLICY "Authenticated users can create conversations"
ON public.conversations FOR INSERT
TO authenticated
WITH CHECK (
    created_by = (SELECT auth.uid())
);

-- SELECT: creator, members, or admins can view
CREATE POLICY "Members can view conversations"
ON public.conversations FOR SELECT
TO authenticated
USING (
    created_by = (SELECT auth.uid())
    OR EXISTS (
        SELECT 1 FROM public.conversation_members
        WHERE conversation_members.conversation_id = conversations.id
        AND conversation_members.user_id = (SELECT auth.uid())
    )
    OR is_admin((SELECT auth.uid()))
);

-- UPDATE: merged policy (was two separate permissive policies — causes double evaluation)
--   Previously: "Admins and creators can update conversations" + "Group members can update conversation"
--   Now: single policy with OR covering both cases
CREATE POLICY "Members and admins can update conversations"
ON public.conversations FOR UPDATE
TO authenticated
USING (
    -- Creator or admin can update any conversation
    created_by = (SELECT auth.uid())
    OR is_admin((SELECT auth.uid()))
    -- Any group member can update group metadata (WhatsApp-style)
    OR (
        is_group = TRUE
        AND EXISTS (
            SELECT 1 FROM public.conversation_members
            WHERE conversation_members.conversation_id = conversations.id
            AND conversation_members.user_id = (SELECT auth.uid())
        )
    )
)
WITH CHECK (
    created_by = (SELECT auth.uid())
    OR is_admin((SELECT auth.uid()))
    OR (
        is_group = TRUE
        AND EXISTS (
            SELECT 1 FROM public.conversation_members
            WHERE conversation_members.conversation_id = conversations.id
            AND conversation_members.user_id = (SELECT auth.uid())
        )
    )
);


-- ============================================================================
-- SECTION 2: public.conversation_members
-- Fixes:
--   multiple_permissive_policies - authenticated INSERT
--     ("Group creator can add members" + "Users can add conversation members")
-- ============================================================================

DROP POLICY IF EXISTS "Group creator can add members"        ON public.conversation_members;
DROP POLICY IF EXISTS "Users can add conversation members"   ON public.conversation_members;

-- INSERT: merged — group creator OR user adding themselves
CREATE POLICY "Users can add conversation members"
ON public.conversation_members FOR INSERT
TO authenticated
WITH CHECK (
    -- User is adding themselves
    conversation_members.user_id = (SELECT auth.uid())
    -- Or user is the group creator
    OR EXISTS (
        SELECT 1 FROM public.conversations c
        WHERE c.id = conversation_members.conversation_id
        AND c.created_by = (SELECT auth.uid())
        AND c.is_group = TRUE
    )
);


-- ============================================================================
-- SECTION 3: public.messages
-- Fixes:
--   auth_rls_initplan - "Members can view messages"
--   auth_rls_initplan - "Members can send messages"
--   auth_rls_initplan - "Senders can update own messages"
-- ============================================================================

DROP POLICY IF EXISTS "Members can view messages"      ON public.messages;
DROP POLICY IF EXISTS "Members can send messages"      ON public.messages;
DROP POLICY IF EXISTS "Senders can update own messages" ON public.messages;

CREATE POLICY "Members can view messages"
ON public.messages FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.conversation_members
        WHERE conversation_members.conversation_id = messages.conversation_id
        AND conversation_members.user_id = (SELECT auth.uid())
    )
);

CREATE POLICY "Members can send messages"
ON public.messages FOR INSERT
TO authenticated
WITH CHECK (
    sender_id = (SELECT auth.uid())
    AND EXISTS (
        SELECT 1 FROM public.conversation_members
        WHERE conversation_members.conversation_id = messages.conversation_id
        AND conversation_members.user_id = (SELECT auth.uid())
    )
);

CREATE POLICY "Senders can update own messages"
ON public.messages FOR UPDATE
TO authenticated
USING (sender_id = (SELECT auth.uid()))
WITH CHECK (sender_id = (SELECT auth.uid()));


-- ============================================================================
-- SECTION 4: public.message_reads
-- Fixes:
--   auth_rls_initplan - "Users can view read receipts"
--   auth_rls_initplan - "Users can mark messages as read"
-- ============================================================================

DROP POLICY IF EXISTS "Users can view read receipts"    ON public.message_reads;
DROP POLICY IF EXISTS "Users can mark messages as read" ON public.message_reads;

CREATE POLICY "Users can view read receipts"
ON public.message_reads FOR SELECT
TO authenticated
USING (
    user_id = (SELECT auth.uid())
    OR EXISTS (
        SELECT 1 FROM public.messages m
        JOIN public.conversation_members cm
          ON cm.conversation_id = m.conversation_id
        WHERE m.id = message_reads.message_id
        AND cm.user_id = (SELECT auth.uid())
    )
);

CREATE POLICY "Users can mark messages as read"
ON public.message_reads FOR INSERT
TO authenticated
WITH CHECK (user_id = (SELECT auth.uid()));


-- ============================================================================
-- SECTION 5: public.message_reactions
-- Fixes:
--   auth_rls_initplan - "Users can view reactions on accessible messages"
--   auth_rls_initplan - "Users can add reactions to accessible messages"
--   auth_rls_initplan - "Users can remove their own reactions"
-- ============================================================================

DROP POLICY IF EXISTS "Users can view reactions on accessible messages" ON public.message_reactions;
DROP POLICY IF EXISTS "Users can add reactions to accessible messages"  ON public.message_reactions;
DROP POLICY IF EXISTS "Users can remove their own reactions"            ON public.message_reactions;

CREATE POLICY "Users can view reactions on accessible messages"
ON public.message_reactions FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.conversation_members cm
        JOIN public.messages m ON m.conversation_id = cm.conversation_id
        WHERE m.id = message_reactions.message_id
        AND cm.user_id = (SELECT auth.uid())
    )
);

CREATE POLICY "Users can add reactions to accessible messages"
ON public.message_reactions FOR INSERT
TO authenticated
WITH CHECK (
    user_id = (SELECT auth.uid())
    AND EXISTS (
        SELECT 1 FROM public.conversation_members cm
        JOIN public.messages m ON m.conversation_id = cm.conversation_id
        WHERE m.id = message_reactions.message_id
        AND cm.user_id = (SELECT auth.uid())
    )
);

CREATE POLICY "Users can remove their own reactions"
ON public.message_reactions FOR DELETE
TO authenticated
USING (user_id = (SELECT auth.uid()));


-- ============================================================================
-- SECTION 6: public.typing_status
-- Fixes:
--   auth_rls_initplan  - "Members can view typing status"
--   auth_rls_initplan  - "Users can update own typing status"
--   multiple_permissive_policies - anon/authenticated/authenticator/cli/dashboard SELECT
--     ("Members can view typing status" + "Users can update own typing status" clash on SELECT)
-- Note: "Users can update own typing status" has FOR UPDATE, but the SELECT
-- USING clause is also evaluated on SELECT → Postgres warns about two SELECT-
-- permissive policies. Fix: ensure only one policy covers SELECT.
-- ============================================================================

DROP POLICY IF EXISTS "Members can view typing status"    ON public.typing_status;
DROP POLICY IF EXISTS "Users can update own typing status" ON public.typing_status;

CREATE POLICY "Members can view typing status"
ON public.typing_status FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.conversation_members
        WHERE conversation_members.conversation_id = typing_status.conversation_id
        AND conversation_members.user_id = (SELECT auth.uid())
    )
);

CREATE POLICY "Users can update own typing status"
ON public.typing_status FOR INSERT
TO authenticated
WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "Users can upsert own typing status"
ON public.typing_status FOR UPDATE
TO authenticated
USING (user_id = (SELECT auth.uid()))
WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "Users can delete own typing status"
ON public.typing_status FOR DELETE
TO authenticated
USING (user_id = (SELECT auth.uid()));


-- ============================================================================
-- SECTION 7: public.users
-- Fixes:
--   auth_rls_initplan  - "Users can update own profile"
--   auth_rls_initplan  - "Admins can manage all users"
--   multiple_permissive_policies - SELECT (anon/authenticated/authenticator/cli/dashboard)
--     ("Admins can manage all users" + "Users can view all users")
--   multiple_permissive_policies - UPDATE (same roles)
--     ("Admins can manage all users" + "Users can update own profile")
-- ============================================================================

DROP POLICY IF EXISTS "Users can view all users"      ON public.users;
DROP POLICY IF EXISTS "Admins can manage all users"   ON public.users;
DROP POLICY IF EXISTS "Users can update own profile"  ON public.users;

-- SELECT: merged — all authenticated users can view all users (was two permissive policies)
CREATE POLICY "Users can view all users"
ON public.users FOR SELECT
TO authenticated
USING (true);

-- UPDATE: merged — owner can update their own profile, admin can update any
CREATE POLICY "Users can update own profile or admins all"
ON public.users FOR UPDATE
TO authenticated
USING (
    id = (SELECT auth.uid())
    OR is_admin((SELECT auth.uid()))
)
WITH CHECK (
    id = (SELECT auth.uid())
    OR is_admin((SELECT auth.uid()))
);

-- INSERT/DELETE: admins only
CREATE POLICY "Admins can insert users"
ON public.users FOR INSERT
TO authenticated
WITH CHECK (is_admin((SELECT auth.uid())));

CREATE POLICY "Admins can delete users"
ON public.users FOR DELETE
TO authenticated
USING (is_admin((SELECT auth.uid())));


-- ============================================================================
-- SECTION 8: public.app_settings
-- Fixes:
--   auth_rls_initplan  - "Admins can update settings"
--   multiple_permissive_policies - SELECT (anon/authenticated/authenticator/cli/dashboard)
--     ("Admins can update settings" + "Anyone can read settings")
-- ============================================================================

DROP POLICY IF EXISTS "Anyone can read settings"    ON public.app_settings;
DROP POLICY IF EXISTS "Admins can update settings"  ON public.app_settings;

-- SELECT: single unified read policy
CREATE POLICY "Anyone can read settings"
ON public.app_settings FOR SELECT
USING (true);

-- UPDATE: admins only, with (SELECT auth.uid())
CREATE POLICY "Admins can update settings"
ON public.app_settings FOR UPDATE
TO authenticated
USING (is_admin((SELECT auth.uid())))
WITH CHECK (is_admin((SELECT auth.uid())));


-- ============================================================================
-- SECTION 9: public.tasks
-- Fixes:
--   auth_rls_initplan - "Users can view tasks based on visibility"
--   auth_rls_initplan - "Users can create tasks for same or lower level"
--   auth_rls_initplan - "Task creator and assignees can update tasks"
--   auth_rls_initplan - "Task creator and admins can delete tasks"
--   auth_rls_initplan - "Task assigner can update their tasks"
--   auth_rls_initplan - "Task assigner can delete their tasks"
--   multiple_permissive_policies - authenticated UPDATE
--     ("Task assigner can update their tasks" + "Task creator and assignees can update tasks")
--   multiple_permissive_policies - authenticated DELETE
--     ("Task assigner can delete their tasks" + "Task creator and admins can delete tasks")
-- ============================================================================

DROP POLICY IF EXISTS "Users can view tasks based on visibility"       ON public.tasks;
DROP POLICY IF EXISTS "Users can create tasks for same or lower level"  ON public.tasks;
DROP POLICY IF EXISTS "Task creator and assignees can update tasks"     ON public.tasks;
DROP POLICY IF EXISTS "Task creator and admins can delete tasks"        ON public.tasks;
DROP POLICY IF EXISTS "Task assigner can update their tasks"            ON public.tasks;
DROP POLICY IF EXISTS "Task assigner can delete their tasks"            ON public.tasks;

-- SELECT
CREATE POLICY "Users can view tasks based on visibility"
ON public.tasks FOR SELECT
TO authenticated
USING (
    assigned_by = (SELECT auth.uid())
    OR is_task_assignee(id, (SELECT auth.uid()))
    OR is_admin_user((SELECT auth.uid()))
);

-- INSERT
CREATE POLICY "Users can create tasks for same or lower level"
ON public.tasks FOR INSERT
TO authenticated
WITH CHECK (
    assigned_by = (SELECT auth.uid())
    OR is_admin_user((SELECT auth.uid()))
);

-- UPDATE: merged ("Task assigner can update their tasks" + "Task creator and assignees can update tasks")
CREATE POLICY "Task creator and assignees can update tasks"
ON public.tasks FOR UPDATE
TO authenticated
USING (
    assigned_by = (SELECT auth.uid())
    OR is_task_assignee(id, (SELECT auth.uid()))
    OR is_admin_user((SELECT auth.uid()))
);

-- DELETE: merged ("Task assigner can delete their tasks" + "Task creator and admins can delete tasks")
CREATE POLICY "Task creator and admins can delete tasks"
ON public.tasks FOR DELETE
TO authenticated
USING (
    assigned_by = (SELECT auth.uid())
    OR is_admin_user((SELECT auth.uid()))
);


-- ============================================================================
-- SECTION 10: public.task_assignees
-- Fixes:
--   auth_rls_initplan - "Users can view task assignees"
--   auth_rls_initplan - "Task creator can add assignees"
--   auth_rls_initplan - "Task creator can remove assignees"
-- ============================================================================

DROP POLICY IF EXISTS "Users can view task assignees"   ON public.task_assignees;
DROP POLICY IF EXISTS "Task creator can add assignees"  ON public.task_assignees;
DROP POLICY IF EXISTS "Task creator can remove assignees" ON public.task_assignees;

CREATE POLICY "Users can view task assignees"
ON public.task_assignees FOR SELECT
TO authenticated
USING (
    user_id = (SELECT auth.uid())
    OR is_task_creator(task_id, (SELECT auth.uid()))
    OR is_task_assignee(task_id, (SELECT auth.uid()))
    OR is_admin_user((SELECT auth.uid()))
);

CREATE POLICY "Task creator can add assignees"
ON public.task_assignees FOR INSERT
TO authenticated
WITH CHECK (
    is_task_creator(task_id, (SELECT auth.uid()))
    OR is_admin_user((SELECT auth.uid()))
);

CREATE POLICY "Task creator can remove assignees"
ON public.task_assignees FOR DELETE
TO authenticated
USING (
    is_task_creator(task_id, (SELECT auth.uid()))
    OR is_admin_user((SELECT auth.uid()))
);


-- ============================================================================
-- SECTION 11: public.task_messages
-- Fixes:
--   auth_rls_initplan - "Task participants can view messages"
--   auth_rls_initplan - "Task participants can send messages"
-- ============================================================================

DROP POLICY IF EXISTS "Task participants can view messages" ON public.task_messages;
DROP POLICY IF EXISTS "Task participants can send messages" ON public.task_messages;

CREATE POLICY "Task participants can view messages"
ON public.task_messages FOR SELECT
TO authenticated
USING (
    is_task_creator(task_id, (SELECT auth.uid()))
    OR is_task_assignee(task_id, (SELECT auth.uid()))
    OR is_admin_user((SELECT auth.uid()))
);

CREATE POLICY "Task participants can send messages"
ON public.task_messages FOR INSERT
TO authenticated
WITH CHECK (
    sender_id = (SELECT auth.uid())
    AND (
        is_task_creator(task_id, (SELECT auth.uid()))
        OR is_task_assignee(task_id, (SELECT auth.uid()))
    )
);


-- ============================================================================
-- SECTION 12: public.task_notes
-- Fixes:
--   auth_rls_initplan - "Notes visible based on visibility setting"
--   auth_rls_initplan - "Task assigner can add notes"
-- ============================================================================

DROP POLICY IF EXISTS "Notes visible based on visibility setting" ON public.task_notes;
DROP POLICY IF EXISTS "Task assigner can add notes"               ON public.task_notes;

CREATE POLICY "Notes visible based on visibility setting"
ON public.task_notes FOR SELECT
TO authenticated
USING (
    added_by = (SELECT auth.uid())
    OR is_task_creator(task_id, (SELECT auth.uid()))
    OR is_task_assignee(task_id, (SELECT auth.uid()))
    OR is_admin_user((SELECT auth.uid()))
);

CREATE POLICY "Task assigner can add notes"
ON public.task_notes FOR INSERT
TO authenticated
WITH CHECK (
    added_by = (SELECT auth.uid())
    AND (
        is_task_creator(task_id, (SELECT auth.uid()))
        OR is_admin_user((SELECT auth.uid()))
    )
);


-- ============================================================================
-- SECTION 13: public.task_message_reactions
-- Fixes:
--   auth_rls_initplan - "Users can view reactions on accessible task messages"
--   auth_rls_initplan - "Users can add reactions to accessible task messages"
--   auth_rls_initplan - "Users can delete own reactions"
-- ============================================================================

DROP POLICY IF EXISTS "Users can view reactions on accessible task messages" ON public.task_message_reactions;
DROP POLICY IF EXISTS "Users can add reactions to accessible task messages"  ON public.task_message_reactions;
DROP POLICY IF EXISTS "Users can delete own reactions"                       ON public.task_message_reactions;

CREATE POLICY "Users can view reactions on accessible task messages"
ON public.task_message_reactions FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.task_messages tm
        JOIN public.tasks t ON tm.task_id = t.id
        WHERE tm.id = task_message_reactions.message_id
        AND (
            t.assigned_by = (SELECT auth.uid())
            OR is_task_assignee(t.id, (SELECT auth.uid()))
            OR is_admin_user((SELECT auth.uid()))
        )
    )
);

CREATE POLICY "Users can add reactions to accessible task messages"
ON public.task_message_reactions FOR INSERT
TO authenticated
WITH CHECK (
    user_id = (SELECT auth.uid())
    AND EXISTS (
        SELECT 1 FROM public.task_messages tm
        JOIN public.tasks t ON tm.task_id = t.id
        WHERE tm.id = task_message_reactions.message_id
        AND (
            t.assigned_by = (SELECT auth.uid())
            OR is_task_assignee(t.id, (SELECT auth.uid()))
            OR is_admin_user((SELECT auth.uid()))
        )
    )
);

CREATE POLICY "Users can delete own reactions"
ON public.task_message_reactions FOR DELETE
TO authenticated
USING (user_id = (SELECT auth.uid()));


-- ============================================================================
-- SECTION 14: public.voice_channels
-- Fixes:
--   auth_rls_initplan  - "Admins can manage voice channels"
--   multiple_permissive_policies - authenticated SELECT
--     ("Admins can manage voice channels" + "Authenticated users can view voice channels")
-- ============================================================================

DROP POLICY IF EXISTS "Authenticated users can view voice channels" ON public.voice_channels;
DROP POLICY IF EXISTS "Admins can manage voice channels"            ON public.voice_channels;

-- SELECT: single policy — all authenticated users can view
CREATE POLICY "Authenticated users can view voice channels"
ON public.voice_channels FOR SELECT
TO authenticated
USING (true);

-- INSERT/UPDATE/DELETE: admins only
CREATE POLICY "Admins can manage voice channels"
ON public.voice_channels FOR ALL
TO authenticated
USING (is_admin((SELECT auth.uid())))
WITH CHECK (is_admin((SELECT auth.uid())));


-- ============================================================================
-- SECTION 15: public.voice_channel_participants
-- Fixes:
--   auth_rls_initplan - "Users can join channels (insert own record)"
--   auth_rls_initplan - "Users can update own participation state"
--   auth_rls_initplan - "Users can leave channels (delete own record)"
-- ============================================================================

DROP POLICY IF EXISTS "Users can join channels (insert own record)"   ON public.voice_channel_participants;
DROP POLICY IF EXISTS "Users can update own participation state"       ON public.voice_channel_participants;
DROP POLICY IF EXISTS "Users can leave channels (delete own record)"  ON public.voice_channel_participants;

CREATE POLICY "Users can join channels (insert own record)"
ON public.voice_channel_participants FOR INSERT
TO authenticated
WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "Users can update own participation state"
ON public.voice_channel_participants FOR UPDATE
TO authenticated
USING (user_id = (SELECT auth.uid()))
WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "Users can leave channels (delete own record)"
ON public.voice_channel_participants FOR DELETE
TO authenticated
USING (user_id = (SELECT auth.uid()));


-- ============================================================================
-- SECTION 16: public.voice_channel_sessions
-- Fixes:
--   auth_rls_initplan - "Users can view own session history"
--   auth_rls_initplan - "System can create sessions"
--   auth_rls_initplan - "System can update sessions"
-- ============================================================================

DROP POLICY IF EXISTS "Users can view own session history" ON public.voice_channel_sessions;
DROP POLICY IF EXISTS "System can create sessions"         ON public.voice_channel_sessions;
DROP POLICY IF EXISTS "System can update sessions"         ON public.voice_channel_sessions;

CREATE POLICY "Users can view own session history"
ON public.voice_channel_sessions FOR SELECT
TO authenticated
USING (
    user_id = (SELECT auth.uid())
    OR is_admin((SELECT auth.uid()))
);

CREATE POLICY "System can create sessions"
ON public.voice_channel_sessions FOR INSERT
TO authenticated
WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "System can update sessions"
ON public.voice_channel_sessions FOR UPDATE
TO authenticated
USING (user_id = (SELECT auth.uid()));


-- ============================================================================
-- SECTION 17: public.ai_sessions
-- Fixes:
--   auth_rls_initplan - "Host can update their ai_session"
-- ============================================================================

DROP POLICY IF EXISTS "Host can update their ai_session" ON public.ai_sessions;

CREATE POLICY "Host can update their ai_session"
ON public.ai_sessions FOR UPDATE
TO authenticated
USING (host_user_id = (SELECT auth.uid()));


-- ============================================================================
-- SECTION 18: public.ai_bot_config
-- Fixes:
--   auth_rls_initplan - "Admins can update ai_bot_config"
-- ============================================================================

DROP POLICY IF EXISTS "Admins can update ai_bot_config" ON public.ai_bot_config;

CREATE POLICY "Admins can update ai_bot_config"
ON public.ai_bot_config FOR UPDATE
TO authenticated
USING (EXISTS (SELECT 1 FROM users WHERE id = (SELECT auth.uid()) AND is_admin = true))
WITH CHECK (EXISTS (SELECT 1 FROM users WHERE id = (SELECT auth.uid()) AND is_admin = true));
