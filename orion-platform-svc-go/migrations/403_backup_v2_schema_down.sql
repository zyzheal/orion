-- Reverse 403_backup_v2_schema.sql.
-- Drops 5 tables created by this migration.
-- Order: child tables first (CASCADE handles FK dependencies).
--
DROP TABLE IF EXISTS backup_archive CASCADE;
DROP TABLE IF EXISTS verification_results CASCADE;
DROP TABLE IF EXISTS recovery_records CASCADE;
DROP TABLE IF EXISTS backup_records CASCADE;
DROP TABLE IF EXISTS backup_plans CASCADE;
