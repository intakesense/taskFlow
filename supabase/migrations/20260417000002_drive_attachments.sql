-- Drive attachments: stores Google Drive file metadata attached to tasks or messages.
-- file_id is the Drive file ID used for sharing and preview links.

CREATE TABLE drive_attachments (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  uploader_id  uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  -- One of these is set (task or message), not both
  task_id      uuid REFERENCES tasks(id) ON DELETE CASCADE,
  message_id   uuid REFERENCES messages(id) ON DELETE CASCADE,
  -- Drive file metadata
  file_id      text NOT NULL,          -- Google Drive file ID
  file_name    text NOT NULL,
  mime_type    text NOT NULL,
  web_view_link text NOT NULL,         -- Direct link to open in Drive
  icon_link    text,                   -- Drive thumbnail/icon URL
  created_at   timestamptz NOT NULL DEFAULT now(),
  -- Must belong to exactly one context
  CONSTRAINT drive_attachments_context_check
    CHECK (
      (task_id IS NOT NULL AND message_id IS NULL) OR
      (task_id IS NULL AND message_id IS NOT NULL)
    )
);

CREATE INDEX drive_attachments_task_id_idx    ON drive_attachments (task_id);
CREATE INDEX drive_attachments_message_id_idx ON drive_attachments (message_id);
CREATE INDEX drive_attachments_uploader_idx   ON drive_attachments (uploader_id);

ALTER TABLE drive_attachments ENABLE ROW LEVEL SECURITY;

-- Task attachments: visible to anyone who can see the task
CREATE POLICY "task attachment visibility"
  ON drive_attachments FOR SELECT
  USING (
    task_id IS NOT NULL AND (
      EXISTS (
        SELECT 1 FROM task_assignees ta WHERE ta.task_id = drive_attachments.task_id AND ta.user_id = auth.uid()
      ) OR
      EXISTS (
        SELECT 1 FROM tasks t WHERE t.id = drive_attachments.task_id AND t.assigned_by = auth.uid()
      ) OR
      EXISTS (
        SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.is_admin = true
      )
    )
  );

-- Message attachments: visible to conversation members
CREATE POLICY "message attachment visibility"
  ON drive_attachments FOR SELECT
  USING (
    message_id IS NOT NULL AND
    EXISTS (
      SELECT 1 FROM messages m
      JOIN conversation_members cm ON cm.conversation_id = m.conversation_id
      WHERE m.id = drive_attachments.message_id AND cm.user_id = auth.uid()
    )
  );

-- Only uploader can insert
CREATE POLICY "uploader can insert"
  ON drive_attachments FOR INSERT
  WITH CHECK (auth.uid() = uploader_id);

-- Only uploader can delete
CREATE POLICY "uploader can delete"
  ON drive_attachments FOR DELETE
  USING (auth.uid() = uploader_id);

-- Service role full access (for sharing API route)
CREATE POLICY "service role full access"
  ON drive_attachments FOR ALL
  USING (auth.role() = 'service_role');
