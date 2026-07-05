-- Migration 049: Add type/title/message/read_at to notifications
-- Aligns notifications table with NotificationRepository interface

ALTER TABLE notifications ADD COLUMN IF NOT EXISTS type VARCHAR(100);
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS title VARCHAR(500);
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS message TEXT;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS read_at TIMESTAMPTZ;

-- Backfill title/message from subject/body if they exist
UPDATE notifications SET title = subject WHERE title IS NULL AND subject IS NOT NULL;
UPDATE notifications SET message = body WHERE message IS NULL AND body IS NOT NULL;
