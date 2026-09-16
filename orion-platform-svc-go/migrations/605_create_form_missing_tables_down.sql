-- Reverse 605_create_form_missing_tables.sql.
-- Order: child tables first (they reference forms).
DROP TABLE IF EXISTS form_submissions;
DROP TABLE IF EXISTS form_fields;
DROP TABLE IF EXISTS forms;
