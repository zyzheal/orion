-- Rollback Migration 017_create_notifications
-- Auto-generated rollback script
-- Review carefully before executing in production

-- Dropping table: notification_channels
DROP TABLE IF EXISTS notification_channels CASCADE;

-- Dropping table: notification_templates
DROP TABLE IF EXISTS notification_templates CASCADE;

-- Dropping table: notifications
DROP TABLE IF EXISTS notifications CASCADE;

DROP INDEX IF EXISTS CREATE INDEX idx_notification_channel;
DROP INDEX IF EXISTS CREATE INDEX idx_notification_template;
DROP INDEX IF EXISTS CREATE INDEX idx_notification;
DROP INDEX IF EXISTS CREATE INDEX idx_notification;
DROP INDEX IF EXISTS CREATE INDEX idx_notification;
