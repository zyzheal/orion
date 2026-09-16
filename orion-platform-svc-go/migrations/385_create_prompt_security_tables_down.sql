-- Reverse 385_create_prompt_security_tables.sql.
-- Drops 2 tables created by this migration.
-- Order: child tables first (CASCADE handles FK dependencies).
--
DROP TABLE IF EXISTS prompt_security_scans CASCADE;
DROP TABLE IF EXISTS prompt_security_configs CASCADE;
