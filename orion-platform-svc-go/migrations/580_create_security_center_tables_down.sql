-- Migration 580 down: remove the security center tables and the audit-planning
-- columns added for internal/security.
--
-- NOTE: the migration runner already wraps each file in its own transaction, so
-- a literal BEGIN;/COMMIT; here would commit the runner's transaction early and
-- make tx.Commit() fail with 'pq: unexpected transaction status idle'.
--
-- The columns added in the up migration are owned jointly by
-- internal/security and internal/security-compliance, so the down file drops
-- them only when they are not referenced by an index any more.

DROP TABLE IF EXISTS security_scans;
DROP TABLE IF EXISTS security_findings;
DROP TABLE IF EXISTS compliance_evaluations;
DROP TABLE IF EXISTS supply_chain_sboms;
DROP TABLE IF EXISTS dependency_graphs;
DROP TABLE IF EXISTS dependency_poisoning_scans;

DROP INDEX IF EXISTS idx_audit_findings_execution;
DROP INDEX IF EXISTS idx_compliance_policies_framework_type;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'audit_plans' AND column_name = 'scope'
  ) THEN
    ALTER TABLE audit_plans DROP COLUMN scope;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'audit_plans' AND column_name = 'audit_type'
  ) THEN
    ALTER TABLE audit_plans DROP COLUMN audit_type;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'audit_plans' AND column_name = 'schedule_type'
  ) THEN
    ALTER TABLE audit_plans DROP COLUMN schedule_type;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'audit_plans' AND column_name = 'cron_expression'
  ) THEN
    ALTER TABLE audit_plans DROP COLUMN cron_expression;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'audit_plans' AND column_name = 'reviewers'
  ) THEN
    ALTER TABLE audit_plans DROP COLUMN reviewers;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'audit_executions' AND column_name = 'completed_at'
  ) THEN
    ALTER TABLE audit_executions DROP COLUMN completed_at;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'audit_executions' AND column_name = 'findings_count'
  ) THEN
    ALTER TABLE audit_executions DROP COLUMN findings_count;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'audit_findings' AND column_name = 'execution_id'
  ) THEN
    ALTER TABLE audit_findings DROP COLUMN execution_id;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'audit_findings' AND column_name = 'category'
  ) THEN
    ALTER TABLE audit_findings DROP COLUMN category;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'audit_findings' AND column_name = 'evidence'
  ) THEN
    ALTER TABLE audit_findings DROP COLUMN evidence;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'audit_findings' AND column_name = 'recommendation'
  ) THEN
    ALTER TABLE audit_findings DROP COLUMN recommendation;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'audit_findings' AND column_name = 'assigned_to'
  ) THEN
    ALTER TABLE audit_findings DROP COLUMN assigned_to;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'compliance_policies' AND column_name = 'description'
  ) THEN
    ALTER TABLE compliance_policies DROP COLUMN description;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'compliance_policies' AND column_name = 'framework_type'
  ) THEN
    ALTER TABLE compliance_policies DROP COLUMN framework_type;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'compliance_policies' AND column_name = 'requirements'
  ) THEN
    ALTER TABLE compliance_policies DROP COLUMN requirements;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'compliance_policies' AND column_name = 'severity_threshold'
  ) THEN
    ALTER TABLE compliance_policies DROP COLUMN severity_threshold;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'compliance_policies' AND column_name = 'enabled'
  ) THEN
    ALTER TABLE compliance_policies DROP COLUMN enabled;
  END IF;
END $$;

DO $$ BEGIN
  IF (SELECT column_default FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'compliance_policies'
        AND column_name = 'framework') IS NOT NULL THEN
    ALTER TABLE compliance_policies ALTER COLUMN framework DROP DEFAULT;
  END IF;
END $$;
