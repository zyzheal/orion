-- Auto-generated rollback for version 086. Review before use.

-- WARNING: Data loss may occur. Backup is taken automatically by RunMigrationsDown.

DROP INDEX IF EXISTS "idx_decision_traces_created";

DROP INDEX IF EXISTS "idx_decision_traces_tenant";

DROP TABLE IF EXISTS "decision_traces" CASCADE;

DROP INDEX IF EXISTS "idx_decision_feedbacks_created";

DROP INDEX IF EXISTS "idx_decision_feedbacks_tenant";

DROP TABLE IF EXISTS "decision_feedbacks" CASCADE;

DROP INDEX IF EXISTS "idx_a_i_decisions_created";

DROP INDEX IF EXISTS "idx_a_i_decisions_tenant";
