-- Drop stale participant state columns from voice_channel_participants.
-- These columns were intended to be synced from Daily.co but were never wired up.
-- Mute/video/screen-share state is read directly from Daily.co's local participant
-- state in the client (useParticipantProperty, useVideoTrack, useScreenVideoTrack)
-- and does not need to be persisted in the database.

ALTER TABLE voice_channel_participants
  DROP COLUMN IF EXISTS is_muted,
  DROP COLUMN IF EXISTS is_video_on,
  DROP COLUMN IF EXISTS is_screen_sharing,
  DROP COLUMN IF EXISTS is_speaking,
  DROP COLUMN IF EXISTS connection_quality;
