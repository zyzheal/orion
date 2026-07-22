-- Auto-generated rollback for version 004. Review before use.

-- WARNING: Data loss may occur. Backup is taken automatically by RunMigrationsDown.

DROP INDEX IF EXISTS "idx_ai_decision_traces_tenant_id";

DROP INDEX IF EXISTS "idx_ai_decision_traces_decision_id";

DROP INDEX IF EXISTS "idx_ai_decision_feedback_tenant_id";

DROP INDEX IF EXISTS "idx_ai_decision_feedback_decision_id";

DROP INDEX IF EXISTS "idx_ai_decisions_created_at";

DROP INDEX IF EXISTS "idx_ai_decisions_model_id";

DROP INDEX IF EXISTS "idx_ai_decisions_status";

DROP INDEX IF EXISTS "idx_ai_decisions_type";

DROP TABLE IF EXISTS "ai_decision_traces" CASCADE;

DROP TABLE IF EXISTS "ai_decision_feedback" CASCADE;
