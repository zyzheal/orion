-- Reverse 397_create_alert_escalation.sql.
-- Drops 4 tables created by this migration.
-- Order: child tables first (CASCADE handles FK dependencies).
--
DROP TABLE IF EXISTS alert_metrics CASCADE;
DROP TABLE IF EXISTS alert_closure CASCADE;
DROP TABLE IF EXISTS escalation_trigger CASCADE;
DROP TABLE IF EXISTS escalation_policy CASCADE;
