-- Migration 773 down: Drop llm_call_audit table

BEGIN;

DROP INDEX IF EXISTS idx_llm_call_audit_status;
DROP INDEX IF EXISTS idx_llm_call_audit_confidence;
DROP INDEX IF EXISTS idx_llm_call_audit_human_confirm;
DROP INDEX IF EXISTS idx_llm_call_audit_tenant_decision;

DROP TABLE IF EXISTS llm_call_audit;

COMMIT;
