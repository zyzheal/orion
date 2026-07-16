-- Rollback Migration 024_create_agent_orchestration_tables
-- Auto-generated rollback script
-- Review carefully before executing in production

-- Dropping table: agent_profiles
DROP TABLE IF EXISTS agent_profiles CASCADE;

-- Dropping table: agent_runs
DROP TABLE IF EXISTS agent_runs CASCADE;

-- Dropping table: agent_decisions
DROP TABLE IF EXISTS agent_decisions CASCADE;

-- Dropping table: agent_approvals
DROP TABLE IF EXISTS agent_approvals CASCADE;

DROP INDEX IF EXISTS CREATE INDEX idx_agent_run;
DROP INDEX IF EXISTS CREATE INDEX idx_agent_run;
DROP INDEX IF EXISTS CREATE INDEX idx_agent_deci;
DROP INDEX IF EXISTS CREATE INDEX idx_agent_approval;
DROP INDEX IF EXISTS CREATE INDEX idx_agent_approval;
