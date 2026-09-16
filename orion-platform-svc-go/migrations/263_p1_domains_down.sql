-- Reverse 263_p1_domains.sql.
-- Drops 2 tables created by this migration.
-- Order: child tables first (CASCADE handles FK dependencies).
--
DROP TABLE IF EXISTS correlation_rules CASCADE;
DROP TABLE IF EXISTS correlation_groups CASCADE;
