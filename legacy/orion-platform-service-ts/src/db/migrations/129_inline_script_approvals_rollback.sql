-- Rollback Migration 129_inline_script_approvals
-- Auto-generated rollback script
-- Review carefully before executing in production

-- Dropping table: inline_script_approvals
DROP TABLE IF EXISTS inline_script_approvals CASCADE;

-- Dropping table: approval_decisions
DROP TABLE IF EXISTS approval_decisions CASCADE;

DROP INDEX IF EXISTS CREATE INDEX idx_approval_tenant ON inline_;
DROP INDEX IF EXISTS CREATE INDEX idx_approval_;
DROP INDEX IF EXISTS CREATE INDEX idx_approval_u;
DROP INDEX IF EXISTS CREATE INDEX idx_approval_code_ha;
DROP INDEX IF EXISTS CREATE INDEX idx_deci;
