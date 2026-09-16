-- Reverse 400_create_lowcode_templates_versions.sql.
-- Drops 2 tables created by this migration.
-- Order: child tables first (CASCADE handles FK dependencies).
--
DROP TABLE IF EXISTS lowcode_workflow_version CASCADE;
DROP TABLE IF EXISTS lowcode_templates CASCADE;
