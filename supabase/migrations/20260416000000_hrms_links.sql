-- HRMS account linking table
-- Stores HRMS JWT tokens so TaskFlow can proxy check-in/out on behalf of users.
-- Token is stored server-side and never exposed to the client.

CREATE TABLE IF NOT EXISTS hrms_links (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  hrms_user_id          TEXT NOT NULL,
  hrms_employee_id      TEXT NOT NULL,   -- e.g. "EMP001"
  hrms_employee_name    TEXT NOT NULL,
  hrms_token            TEXT NOT NULL,   -- HRMS JWT
  hrms_token_expires_at TIMESTAMPTZ,
  linked_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_checkin_at       TIMESTAMPTZ,
  last_checkout_at      TIMESTAMPTZ
);

ALTER TABLE hrms_links ENABLE ROW LEVEL SECURITY;

-- Users can only read/modify their own link
CREATE POLICY "hrms_links_own" ON hrms_links
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
