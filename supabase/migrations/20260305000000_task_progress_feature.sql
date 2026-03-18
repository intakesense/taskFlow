-- Add type column to task_messages for distinguishing progress updates from chat messages
-- Progress update: type = 'progress', reply_to_id = NULL
-- Comment on progress: type = 'progress', reply_to_id = <progress_id>
-- Chat message: type = 'message' (default)

ALTER TABLE task_messages
ADD COLUMN IF NOT EXISTS type VARCHAR(20) DEFAULT 'message' NOT NULL;

-- Add constraint for valid types
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'task_messages_type_check'
  ) THEN
    ALTER TABLE task_messages
    ADD CONSTRAINT task_messages_type_check
    CHECK (type IN ('message', 'progress'));
  END IF;
END $$;

-- Add index for efficient filtering by type
CREATE INDEX IF NOT EXISTS idx_task_messages_type
ON task_messages(task_id, type, created_at);

-- Add comment for documentation
COMMENT ON COLUMN task_messages.type IS 'Type of message: message (chat) or progress (progress update). Progress updates with reply_to_id are comments on other progress updates.';
