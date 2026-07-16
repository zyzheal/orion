-- Rollback Migration 108_security_compliance
-- Auto-generated rollback script
-- Review carefully before executing in production

-- Dropping table: compliance_policies
DROP TABLE IF EXISTS compliance_policies CASCADE;

-- Dropping table: compliance_evaluations
DROP TABLE IF EXISTS compliance_evaluations CASCADE;

-- Dropping table: audit_findings
DROP TABLE IF EXISTS audit_findings CASCADE;

DROP INDEX IF EXISTS CREATE INDEX idx_compliance_policie;
DROP INDEX IF EXISTS CREATE INDEX idx_compliance_policie;
DROP INDEX IF EXISTS CREATE INDEX idx_compliance_policie;
DROP INDEX IF EXISTS CREATE INDEX idx_compliance_policie;
DROP INDEX IF EXISTS CREATE INDEX idx_compliance_policie;
DROP INDEX IF EXISTS CREATE INDEX idx_compliance_evaluation;
DROP INDEX IF EXISTS CREATE INDEX idx_compliance_evaluation;
DROP INDEX IF EXISTS CREATE INDEX idx_compliance_evaluation;
DROP INDEX IF EXISTS CREATE INDEX idx_compliance_evaluation;
DROP INDEX IF EXISTS CREATE INDEX idx_compliance_evaluation;
DROP INDEX IF EXISTS CREATE INDEX idx_audit_finding;
DROP INDEX IF EXISTS CREATE INDEX idx_audit_finding;
DROP INDEX IF EXISTS CREATE INDEX idx_audit_finding;
DROP INDEX IF EXISTS CREATE INDEX idx_audit_finding;
DROP INDEX IF EXISTS CREATE INDEX idx_audit_finding;
