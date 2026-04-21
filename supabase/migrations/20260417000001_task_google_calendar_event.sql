-- Store Google Calendar event IDs per task per user.
-- One user may have many tasks; each task can have at most one calendar event per user.

CREATE TABLE task_calendar_events (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id    uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_id   text NOT NULL,   -- Google Calendar event ID
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (task_id, user_id)   -- one event per task per user
);

CREATE INDEX task_calendar_events_task_id_idx ON task_calendar_events (task_id);
CREATE INDEX task_calendar_events_user_id_idx ON task_calendar_events (user_id);

ALTER TABLE task_calendar_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users can manage own calendar events"
  ON task_calendar_events FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "service role full access"
  ON task_calendar_events FOR ALL
  USING (auth.role() = 'service_role');
