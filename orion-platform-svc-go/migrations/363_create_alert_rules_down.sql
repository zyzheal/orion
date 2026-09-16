-- Reverse 363_create_alert_rules.sql.
-- Drops 1 tables created by this migration.
-- Order: child tables first (CASCADE handles FK dependencies).
--
DROP TABLE IF EXISTS alert_rules CASCADE;
