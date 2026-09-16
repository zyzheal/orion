-- Reverse 377_create_incident_actions_table.sql.
-- Drops 1 tables created by this migration.
-- Order: child tables first (CASCADE handles FK dependencies).
--
DROP TABLE IF EXISTS incident_actions CASCADE;
