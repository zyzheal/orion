-- Security-compliance persistence gaps
--
-- Three tables are referenced by
-- internal/security-compliance/repository/repository.go but were never created
-- anywhere in migrations/. Nothing greps them:
--     compliance_scores              (GetLatestScore, UpsertScore)
--     compliance_evaluation_results  (InsertEvaluation)
--     gap_analysis_results           (InsertGapAnalysis)
-- so the repository INSERTed into relations that do not exist and the driver
-- failed on every call. That made the module's three write-read pairs
-- permanently unreachable:
--     POST /api/v1/compliance/evaluate     -> 500 "relation does not exist"
--     GET  /api/v1/compliance/score        -> 500 "relation does not exist"
--     POST /api/v1/compliance/gap-analysis -> 500 "relation does not exist"
-- AutoRemediateCompliance and GenerateEvidenceCollection both route through
-- EvaluateCompliance, so they failed too.
--
-- The shapes follow the columns the repository actually binds:
--   InsertEvaluation    -> id, tenant_id, policy_id, status, score,
--                          failures, warnings, evaluated_at
--   UpsertScore         -> id, tenant_id, overall_score, category_scores,
--                          trend, last_updated   (ON CONFLICT (tenant_id))
--   InsertGapAnalysis   -> id, tenant_id, framework, total_controls,
--                          implemented, partial, not_implemented, gaps
-- failures / warnings / gaps are stored as comma-joined or JSON text because
-- joinStrings / joinGaps already flatten them to strings on the Go side.
--
-- tenant_id is UUID to match 066_create_security_compliance_tables.sql, which
-- created every sibling table (compliance_policies, audit_plans,
-- compliance_frameworks, ...) with tenant_id UUID NOT NULL after
-- 239_unify_tenant_id_to_uuid.sql.
--
-- policy_id is VARCHAR(255), not UUID: compliance_policies.policy_id is
-- VARCHAR(255) and the policy ids the service accepts come from the path, so a
-- caller-supplied value that is not a UUID must reach an empty aggregate rather
-- than a driver error.

CREATE TABLE IF NOT EXISTS compliance_evaluation_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    policy_id VARCHAR(255) NOT NULL,
    status VARCHAR(50),
    score DOUBLE PRECISION,
    failures TEXT,
    warnings TEXT,
    evaluated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_compliance_eval_status CHECK (status IN ('compliant', 'non_compliant', 'partial'))
);

CREATE INDEX IF NOT EXISTS idx_compliance_eval_tenant ON compliance_evaluation_results(tenant_id);
CREATE INDEX IF NOT EXISTS idx_compliance_eval_tenant_policy ON compliance_evaluation_results(tenant_id, policy_id, evaluated_at DESC);
CREATE INDEX IF NOT EXISTS idx_compliance_eval_evaluated_at ON compliance_evaluation_results(evaluated_at DESC);

CREATE TABLE IF NOT EXISTS compliance_scores (
    id UUID NOT NULL,
    tenant_id UUID PRIMARY KEY,
    overall_score DOUBLE PRECISION DEFAULT 0,
    category_scores TEXT,
    trend VARCHAR(50),
    last_updated TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS gap_analysis_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    framework VARCHAR(100),
    total_controls INTEGER DEFAULT 0,
    implemented INTEGER DEFAULT 0,
    partial INTEGER DEFAULT 0,
    not_implemented INTEGER DEFAULT 0,
    gaps TEXT
);

CREATE INDEX IF NOT EXISTS idx_gap_analysis_tenant ON gap_analysis_results(tenant_id);

-- audit_findings already exists (066) but has two gaps of its own.
--
-- CloseFinding accepted a reason and never stored it: the repository built
-- `UPDATE audit_findings SET status='closed', closed_at=$1 WHERE id=$2 AND
-- tenant_id=$3` from a signature of (tenantID, id, reason). The caller typed
-- into a required field and the value was dropped at the store. resolution
-- keeps it.
--
-- target is the subsystem a finding belongs to. audit_findings has report_id and
-- severity but no subject, so the frontend ComplianceScan page had nothing to
-- show in its "target" column and the handler answered with eight hard-coded
-- demo findings instead of the tenant's own rows.

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'audit_findings' AND column_name = 'resolution'
) AND EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'audit_findings'
) THEN
    ALTER TABLE audit_findings ADD COLUMN resolution TEXT;
    COMMENT ON COLUMN audit_findings.resolution IS 'Operator-supplied reason recorded when the finding is closed';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'audit_findings' AND column_name = 'target'
) AND EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'audit_findings'
) THEN
    ALTER TABLE audit_findings ADD COLUMN target VARCHAR(255);
    COMMENT ON COLUMN audit_findings.target IS 'Subsystem or resource the finding applies to';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'audit_findings' AND indexname = 'idx_audit_findings_tenant_created_at'
  ) THEN
    CREATE INDEX idx_audit_findings_tenant_created_at ON audit_findings USING btree (tenant_id, created_at DESC);
  END IF;
END $$;
