-- Reverse 056_ai_agent_tasks.sql.
-- Drops 1 tables created by this migration.
-- Order: child tables first (CASCADE handles FK dependencies).
--
DROP TABLE IF EXISTS ai_agent_tasks CASCADE;
