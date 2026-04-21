-- User Google Tokens
-- Stores per-user Google OAuth tokens for Calendar and Drive API access.
-- Tokens are tied to the user who granted consent via signInWithGoogle.

CREATE TABLE user_google_tokens (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  access_token  text NOT NULL,
  refresh_token text,                    -- null if Google didn't issue one
  expires_at    timestamptz NOT NULL,    -- when access_token expires
  scopes        text NOT NULL,           -- space-separated scopes granted
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id)                       -- one row per user, upsert on re-login
);

-- Index for fast lookup by user
CREATE INDEX user_google_tokens_user_id_idx ON user_google_tokens (user_id);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_user_google_tokens_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_user_google_tokens_updated_at
  BEFORE UPDATE ON user_google_tokens
  FOR EACH ROW EXECUTE FUNCTION update_user_google_tokens_updated_at();

-- RLS: users can only read/write their own tokens
ALTER TABLE user_google_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users can read own google tokens"
  ON user_google_tokens FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "users can upsert own google tokens"
  ON user_google_tokens FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users can update own google tokens"
  ON user_google_tokens FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "users can delete own google tokens"
  ON user_google_tokens FOR DELETE
  USING (auth.uid() = user_id);

-- Service role bypass (needed for server-side token refresh in API routes)
CREATE POLICY "service role full access"
  ON user_google_tokens FOR ALL
  USING (auth.role() = 'service_role');
