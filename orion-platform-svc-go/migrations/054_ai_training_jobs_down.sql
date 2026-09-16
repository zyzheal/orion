-- Reverse 054_ai_training_jobs.sql.
-- Drops 1 tables created by this migration.
-- Order: child tables first (CASCADE handles FK dependencies).
--
DROP TABLE IF EXISTS ai_training_jobs CASCADE;
