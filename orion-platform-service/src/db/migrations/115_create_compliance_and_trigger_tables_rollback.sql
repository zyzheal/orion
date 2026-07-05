-- Rollback Migration 115_create_compliance_and_trigger_tables
-- Auto-generated rollback script
-- Review carefully before executing in production

-- Dropping table: compliance_policies
DROP TABLE IF EXISTS compliance_policies CASCADE;

-- Dropping table: compliance_evaluations
DROP TABLE IF EXISTS compliance_evaluations CASCADE;

-- Dropping table: compliance_remediations
DROP TABLE IF EXISTS compliance_remediations CASCADE;

-- Dropping table: audit_plans
DROP TABLE IF EXISTS audit_plans CASCADE;

-- Dropping table: audit_executions
DROP TABLE IF EXISTS audit_executions CASCADE;

-- Dropping table: audit_findings
DROP TABLE IF EXISTS audit_findings CASCADE;

-- Dropping table: triggers
DROP TABLE IF EXISTS triggers CASCADE;

-- Dropping table: trigger_events
DROP TABLE IF EXISTS trigger_events CASCADE;

-- Dropping table: webhook_endpoints
DROP TABLE IF EXISTS webhook_endpoints CASCADE;

DROP INDEX IF EXISTS idx_compliance_policie;
DROP INDEX IF EXISTS idx_compliance_evaluation;
DROP INDEX IF EXISTS idx_compliance_evaluation;
DROP INDEX IF EXISTS idx_audit_plan;
DROP INDEX IF EXISTS idx_audit_execution;
DROP INDEX IF EXISTS idx_audit_finding;
DROP INDEX IF EXISTS idx_audit_finding;
DROP INDEX IF EXISTS idx_trigger;
DROP INDEX IF EXISTS idx_trigger_event;
DROP INDEX IF EXISTS idx_webhook_endpoint;
DROP INDEX IF EXISTS idx_webhook_endpoint;
