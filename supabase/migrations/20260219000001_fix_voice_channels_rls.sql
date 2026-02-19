-- Fix: Multiple Permissive Policies on public.voice_channels for authenticated SELECT
--
-- Root cause: "Admins can manage voice channels" uses FOR ALL, which implicitly
-- includes SELECT. Combined with "Authenticated users can view voice channels"
-- (FOR SELECT), Postgres sees two permissive policies for the same role+action
-- (authenticated SELECT) and must evaluate both for every SELECT query.
--
-- Fix: Replace the FOR ALL admin policy with explicit INSERT, UPDATE, DELETE
-- policies only, so SELECT is covered by exactly one policy.

DROP POLICY IF EXISTS "Admins can manage voice channels" ON public.voice_channels;

-- Admins can INSERT new voice channels
CREATE POLICY "Admins can insert voice channels"
ON public.voice_channels FOR INSERT
TO authenticated
WITH CHECK (is_admin((SELECT auth.uid())));

-- Admins can UPDATE voice channels
CREATE POLICY "Admins can update voice channels"
ON public.voice_channels FOR UPDATE
TO authenticated
USING (is_admin((SELECT auth.uid())))
WITH CHECK (is_admin((SELECT auth.uid())));

-- Admins can DELETE voice channels
CREATE POLICY "Admins can delete voice channels"
ON public.voice_channels FOR DELETE
TO authenticated
USING (is_admin((SELECT auth.uid())));

-- SELECT is already covered by "Authenticated users can view voice channels" (FOR SELECT USING true)
-- No new SELECT policy needed here.
