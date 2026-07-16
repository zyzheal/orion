-- Rollback Migration 156_pipeline_budget
-- Auto-generated rollback script
-- Review carefully before executing in production

-- Dropping table: pipeline_budgets
DROP TABLE IF EXISTS pipeline_budgets CASCADE;

DROP INDEX IF EXISTS CREATE INDEX idx_budget_pipeline ON pipeline_budget;
DROP INDEX IF EXISTS CREATE INDEX idx_budget_blocked ON pipeline_budget;
