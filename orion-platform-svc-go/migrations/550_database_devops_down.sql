-- Reverse 550_database_devops.sql.
-- Drops 2 tables created by this migration.
-- Order: child tables first (CASCADE handles FK dependencies).
--
DROP TABLE IF EXISTS database_sources CASCADE;
DROP TABLE IF EXISTS database_devops CASCADE;
