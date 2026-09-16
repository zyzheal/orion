-- Reverse 236_add_source_columns.sql.
-- Drop the _source column from all 11 tables and the 3 source-based indexes.
--
-- Note: `DROP COLUMN IF EXISTS` does NOT protect against the table itself being
-- absent. Each ALTER is wrapped in a DO block that first checks for table
-- existence in information_schema, so a deployment missing one of the target
-- tables (e.g. pipeline_runs, which is owned by a pipeline-engine dependency
-- that may not be installed) does not abort the rollback.
--
-- The existence check MUST pin table_schema = 'public'. Without it,
-- information_schema.tables also sees rollback_backup_* schema copies left
-- behind by RunMigrationsDown's backup layer, so IF EXISTS matches a backup
-- copy while the subsequent bare `ALTER TABLE <t>` resolves through search_path
-- to public -- and dies with "relation does not exist".
-- Order: drop indexes first (they reference the column), then drop columns.

DROP INDEX IF EXISTS idx_tickets_source;
DROP INDEX IF EXISTS idx_pipeline_runs_source;
DROP INDEX IF EXISTS idx_change_approvals_source;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'tickets') THEN
        ALTER TABLE tickets DROP COLUMN IF EXISTS _source;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'pipeline_runs') THEN
        ALTER TABLE pipeline_runs DROP COLUMN IF EXISTS _source;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'change_approvals') THEN
        ALTER TABLE change_approvals DROP COLUMN IF EXISTS _source;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'feature_flags') THEN
        ALTER TABLE feature_flags DROP COLUMN IF EXISTS _source;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'workflow_instances') THEN
        ALTER TABLE workflow_instances DROP COLUMN IF EXISTS _source;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'audit_logs') THEN
        ALTER TABLE audit_logs DROP COLUMN IF EXISTS _source;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'slo') THEN
        ALTER TABLE slo DROP COLUMN IF EXISTS _source;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'alert') THEN
        ALTER TABLE alert DROP COLUMN IF EXISTS _source;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'change_requests') THEN
        ALTER TABLE change_requests DROP COLUMN IF EXISTS _source;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'notifications') THEN
        ALTER TABLE notifications DROP COLUMN IF EXISTS _source;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'webhooks') THEN
        ALTER TABLE webhooks DROP COLUMN IF EXISTS _source;
    END IF;
END $$;
