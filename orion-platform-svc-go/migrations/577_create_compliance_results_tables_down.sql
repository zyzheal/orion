-- Reverse of 577_create_compliance_results_tables.sql
--
-- audit_findings was created by 066, so the down only removes the two columns
-- this migration added and leaves the table intact.

DROP INDEX IF EXISTS idx_audit_findings_tenant_created_at;
DROP TABLE IF EXISTS gap_analysis_results;
DROP TABLE IF EXISTS compliance_scores;
DROP TABLE IF EXISTS compliance_evaluation_results;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'audit_findings' AND column_name = 'resolution'
  ) THEN
    ALTER TABLE audit_findings DROP COLUMN resolution;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'audit_findings' AND column_name = 'target'
  ) THEN
    ALTER TABLE audit_findings DROP COLUMN target;
  END IF;
END $$;
