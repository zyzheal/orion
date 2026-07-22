-- Auto-generated rollback for version 066. Review before use.

-- WARNING: Data loss may occur. Backup is taken automatically by RunMigrationsDown.

DROP INDEX IF EXISTS "idx_compliance_evidence_status";

DROP INDEX IF EXISTS "idx_compliance_evidence_policy_id";

DROP INDEX IF EXISTS "idx_compliance_evidence_tenant_id";

DROP TABLE IF EXISTS "compliance_evidence" CASCADE;

DROP INDEX IF EXISTS "idx_audit_findings_status";

DROP INDEX IF EXISTS "idx_audit_findings_severity";

DROP INDEX IF EXISTS "idx_audit_findings_report_id";

DROP INDEX IF EXISTS "idx_audit_findings_tenant_id";

DROP TABLE IF EXISTS "audit_findings" CASCADE;

DROP INDEX IF EXISTS "idx_audit_reports_execution_id";

DROP INDEX IF EXISTS "idx_audit_reports_tenant_id";

DROP TABLE IF EXISTS "audit_reports" CASCADE;

DROP INDEX IF EXISTS "idx_audit_executions_status";

DROP INDEX IF EXISTS "idx_audit_executions_plan_id";

DROP INDEX IF EXISTS "idx_audit_executions_tenant_id";

DROP TABLE IF EXISTS "audit_executions" CASCADE;

DROP INDEX IF EXISTS "idx_audit_plans_status";

DROP INDEX IF EXISTS "idx_audit_plans_tenant_id";

DROP TABLE IF EXISTS "audit_plans" CASCADE;

DROP INDEX IF EXISTS "idx_compliance_frameworks_name";

DROP INDEX IF EXISTS "idx_compliance_frameworks_tenant_id";

DROP TABLE IF EXISTS "compliance_frameworks" CASCADE;

DROP INDEX IF EXISTS "idx_compliance_reports_created_at";

DROP INDEX IF EXISTS "idx_compliance_reports_status";

DROP INDEX IF EXISTS "idx_compliance_reports_policy_id";

DROP INDEX IF EXISTS "idx_compliance_reports_tenant_id";

DROP TABLE IF EXISTS "compliance_reports" CASCADE;

DROP INDEX IF EXISTS "idx_compliance_policies_status";

DROP INDEX IF EXISTS "idx_compliance_policies_framework";

DROP INDEX IF EXISTS "idx_compliance_policies_tenant_id";
