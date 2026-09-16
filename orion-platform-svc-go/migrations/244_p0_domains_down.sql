-- Reverse 244_p0_domains.sql.
-- Drops 8 tables created by this migration.
-- Order: child tables first (CASCADE handles FK dependencies).
--
DROP TABLE IF EXISTS rca_timeline_events CASCADE;
DROP TABLE IF EXISTS rca_root_causes CASCADE;
DROP TABLE IF EXISTS rca_analyses CASCADE;
DROP TABLE IF EXISTS healing_history CASCADE;
DROP TABLE IF EXISTS healing_actions CASCADE;
DROP TABLE IF EXISTS oncall_rotations CASCADE;
DROP TABLE IF EXISTS oncall_schedules CASCADE;
DROP TABLE IF EXISTS alert_silences CASCADE;
