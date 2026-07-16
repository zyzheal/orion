-- Rollback Migration 138_create_quality_gates
-- Auto-generated rollback script
-- Review carefully before executing in production

-- Dropping table: quality_gates
DROP TABLE IF EXISTS quality_gates CASCADE;

-- Dropping table: quality_gate_results
DROP TABLE IF EXISTS quality_gate_results CASCADE;

DROP INDEX IF EXISTS CREATE INDEX idx_quality_gate;
DROP INDEX IF EXISTS CREATE INDEX idx_quality_gate;
DROP INDEX IF EXISTS CREATE INDEX idx_quality_gate;
DROP INDEX IF EXISTS CREATE INDEX idx_quality_gate_re;
DROP INDEX IF EXISTS CREATE INDEX idx_quality_gate_re;
DROP INDEX IF EXISTS CREATE INDEX idx_quality_gate_re;
