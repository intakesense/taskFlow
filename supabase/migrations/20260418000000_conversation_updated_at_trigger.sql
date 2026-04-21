-- Fix: Auto-update conversations.updated_at whenever a message is inserted.
-- Previously this was done via application code after insert, which is fragile
-- (separate round-trip, silently ignorable error, bypassable by any other client).
-- A trigger is atomic and applies regardless of how a message is created.

CREATE OR REPLACE FUNCTION update_conversation_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE conversations
  SET updated_at = NEW.created_at
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_message_inserted
  AFTER INSERT ON messages
  FOR EACH ROW
  EXECUTE FUNCTION update_conversation_timestamp();
