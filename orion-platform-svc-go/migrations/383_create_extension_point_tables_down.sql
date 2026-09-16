-- Reverse 383_create_extension_point_tables.sql.
-- Drops 2 tables created by this migration.
-- Order: child tables first (CASCADE handles FK dependencies).
--
DROP TABLE IF EXISTS startup_tasks CASCADE;
DROP TABLE IF EXISTS extension_points CASCADE;
