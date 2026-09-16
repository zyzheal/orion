-- Reverse 389_create_recording_records.sql.
-- Drops 1 tables created by this migration.
-- Order: child tables first (CASCADE handles FK dependencies).
--
DROP TABLE IF EXISTS recording_records CASCADE;
