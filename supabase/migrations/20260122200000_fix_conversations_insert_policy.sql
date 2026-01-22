-- Fix: Allow authenticated users to create conversations
--
-- ROOT CAUSE: The INSERT succeeded but RETURNING * triggered a SELECT.
-- The SELECT policy only allowed conversation members to view, but the creator
-- wasn't added as a member yet - classic RLS timing issue.
--
-- Two fixes applied:
-- 1. INSERT policy: Allow authenticated users to create conversations
-- 2. SELECT policy: Allow creators to view their own conversations immediately

-- Fix 1: INSERT policy
DROP POLICY IF EXISTS "Users can create conversations" ON public.conversations;
DROP POLICY IF EXISTS "Authenticated users can create conversations" ON public.conversations;

CREATE POLICY "Authenticated users can create conversations" ON public.conversations
  FOR INSERT WITH CHECK (
    auth.uid() IS NOT NULL
    AND created_by = auth.uid()
  );

-- Fix 2: SELECT policy - add created_by check so creator can see the conversation
-- before members are added (fixes RETURNING * issue)
DROP POLICY IF EXISTS "Members can view conversations" ON public.conversations;

CREATE POLICY "Members can view conversations" ON public.conversations
  FOR SELECT USING (
    created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.conversation_members
      WHERE conversation_members.conversation_id = conversations.id
      AND conversation_members.user_id = auth.uid()
    )
    OR is_admin(auth.uid())
  );
