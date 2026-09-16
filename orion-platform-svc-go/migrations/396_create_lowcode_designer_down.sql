-- Reverse 396_create_lowcode_designer.sql.
-- Drops 5 tables created by this migration.
-- Order: child tables first (CASCADE handles FK dependencies).
--
DROP TABLE IF EXISTS component_registry CASCADE;
DROP TABLE IF EXISTS form_instance CASCADE;
DROP TABLE IF EXISTS form_template CASCADE;
DROP TABLE IF EXISTS form_field CASCADE;
DROP TABLE IF EXISTS form_definition CASCADE;
