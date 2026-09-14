-- Migration 580: security center tables for internal/security
--
-- Two separate defects are fixed here.
--
-- (1) Missing relations. migrations/security/001_create_security_tables.sql
--     defines six of the tables below, but the migration runner
--     (go-common database.LoadMigrations) only reads the flat migrations/
--     directory, so every file under migrations/security/ is never executed.
--     Every read and write in internal/security against security_scans,
--     security_findings, compliance_evaluations, supply_chain_sboms,
--     dependency_graphs and dependency_poisoning_scans therefore failed at
--     runtime with 'relation does not exist' and the /security routes answered
--     500 for an empty and for a populated database alike. The CREATE TABLEs are
--     copied from that file; both files now coexist and CREATE IF NOT EXISTS
--     keeps them idempotent.
--
-- (2) Schema drift on the four tables 066_create_security_compliance_tables.sql
--     owns. 066 creates audit_plans, audit_executions, audit_findings and
--     compliance_policies with the column set internal/security-compliance
--     expects. internal/security reads and writes a different, richer column
--     set (scope / audit_type / reviewers / completed_at / execution_id /
--     evidence / framework_type / requirements / enabled ...). Those columns
--     have no runnable DDL anywhere, so every INSERT in
--     internal/security/repository failed with 'column X does not exist'.
--     The ALTERs below add the missing columns and relax the two NOT NULL
--     constraints that only one of the two writers ever supplies. The 066
--     columns are left untouched, so security-compliance keeps working: the
--     repository there selects an explicit column list and never sees the new
--     ones.
--
-- created_by is deliberately not re-added: 572_add_audit_columns.sql already
-- created it as UUID REFERENCES users(id) on all four tables.
--
-- NOTE: the migration runner already wraps each file in its own transaction, so
-- a literal BEGIN;/COMMIT; here would commit the runner's transaction early and
-- make tx.Commit() fail with 'pq: unexpected transaction status idle'.

-- ==================== Tables with no runnable DDL anywhere ====================

CREATE TABLE IF NOT EXISTS security_scans (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL,
    scan_type VARCHAR(32) NOT NULL DEFAULT 'vulnerability',
    target VARCHAR(512) NOT NULL,
    scanner VARCHAR(64) NOT NULL DEFAULT 'trivy',
    status VARCHAR(32) NOT NULL DEFAULT 'pending',
    critical_count INT NOT NULL DEFAULT 0,
    high_count INT NOT NULL DEFAULT 0,
    medium_count INT NOT NULL DEFAULT 0,
    low_count INT NOT NULL DEFAULT 0,
    total_count INT NOT NULL DEFAULT 0,
    passed BOOLEAN NOT NULL DEFAULT false,
    gate_failed BOOLEAN NOT NULL DEFAULT false,
    scan_start_time TIMESTAMPTZ,
    scan_end_time TIMESTAMPTZ,
    duration_ms INT NOT NULL DEFAULT 0,
    result JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_security_scans_tenant ON security_scans(tenant_id, created_at DESC);

CREATE TABLE IF NOT EXISTS security_findings (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL,
    scan_id VARCHAR(64),
    rule_id VARCHAR(128) NOT NULL,
    severity VARCHAR(16) NOT NULL DEFAULT 'medium',
    category VARCHAR(64) NOT NULL DEFAULT 'general',
    title VARCHAR(512) NOT NULL,
    description TEXT,
    file_path VARCHAR(1024),
    line_start INT,
    line_end INT,
    code_snippet TEXT,
    match_text TEXT,
    confidence REAL NOT NULL DEFAULT 0.5,
    remediation TEXT,
    status VARCHAR(32) NOT NULL DEFAULT 'open',
    assigned_to VARCHAR(128),
    closed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_security_findings_tenant ON security_findings(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_security_findings_scan ON security_findings(scan_id);
CREATE INDEX IF NOT EXISTS idx_security_findings_severity ON security_findings(tenant_id, severity);

CREATE TABLE IF NOT EXISTS compliance_evaluations (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL,
    policy_id VARCHAR(64) NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'running',
    score REAL NOT NULL DEFAULT 0,
    total_checks INT NOT NULL DEFAULT 0,
    passed_checks INT NOT NULL DEFAULT 0,
    failed_checks INT NOT NULL DEFAULT 0,
    gaps JSONB NOT NULL DEFAULT '[]',
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_security_evaluations_policy ON compliance_evaluations(policy_id);
CREATE INDEX IF NOT EXISTS idx_security_evaluations_tenant ON compliance_evaluations(tenant_id);

CREATE TABLE IF NOT EXISTS supply_chain_sboms (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL,
    artifact_id VARCHAR(128) NOT NULL,
    pipeline_id VARCHAR(128),
    sbom_format VARCHAR(32) NOT NULL DEFAULT 'cyclonedx',
    sbom_version VARCHAR(16) NOT NULL DEFAULT '1.4',
    components JSONB NOT NULL DEFAULT '[]',
    dependencies JSONB NOT NULL DEFAULT '[]',
    vulnerabilities JSONB NOT NULL DEFAULT '[]',
    metadata JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_supply_chain_sboms_tenant ON supply_chain_sboms(tenant_id);
CREATE INDEX IF NOT EXISTS idx_supply_chain_sboms_artifact ON supply_chain_sboms(artifact_id);

CREATE TABLE IF NOT EXISTS dependency_graphs (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL,
    package_name VARCHAR(256) NOT NULL,
    package_version VARCHAR(64) NOT NULL,
    direct_deps JSONB NOT NULL DEFAULT '[]',
    transitive_deps JSONB NOT NULL DEFAULT '[]',
    vulnerable_paths JSONB NOT NULL DEFAULT '[]',
    depth INT NOT NULL DEFAULT 3,
    analyzed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dependency_graphs_tenant ON dependency_graphs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_dependency_graphs_package ON dependency_graphs(package_name, package_version);

CREATE TABLE IF NOT EXISTS dependency_poisoning_scans (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL,
    packages_scanned INT NOT NULL DEFAULT 0,
    malicious_found INT NOT NULL DEFAULT 0,
    typosquatting_found INT NOT NULL DEFAULT 0,
    risk_score INT NOT NULL DEFAULT 0,
    risk_level VARCHAR(16) NOT NULL DEFAULT 'safe',
    scan_data JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dependency_poisoning_scans_tenant ON dependency_poisoning_scans(tenant_id);

-- ==================== audit_plans ====================
-- 066 created it with (id, tenant_id, name, description, schedule, status,
-- created_at, updated_at). internal/security additionally needs scope,
-- audit_type, schedule_type, cron_expression and reviewers.

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'audit_plans' AND column_name = 'scope'
  ) THEN
    ALTER TABLE audit_plans ADD COLUMN scope JSONB NOT NULL DEFAULT '{}';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'audit_plans' AND column_name = 'audit_type'
  ) THEN
    ALTER TABLE audit_plans ADD COLUMN audit_type VARCHAR(64) NOT NULL DEFAULT 'security';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'audit_plans' AND column_name = 'schedule_type'
  ) THEN
    ALTER TABLE audit_plans ADD COLUMN schedule_type VARCHAR(32) NOT NULL DEFAULT 'manual';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'audit_plans' AND column_name = 'cron_expression'
  ) THEN
    ALTER TABLE audit_plans ADD COLUMN cron_expression VARCHAR(128);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'audit_plans' AND column_name = 'reviewers'
  ) THEN
    ALTER TABLE audit_plans ADD COLUMN reviewers JSONB NOT NULL DEFAULT '[]';
  END IF;
END $$;

-- ==================== audit_executions ====================
-- 066 created it with (id, tenant_id, plan_id, status, result, started_at,
-- ended_at); 572 added created_at. internal/security writes findings_count and
-- completed_at instead of ended_at, so both time columns coexist.

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'audit_executions' AND column_name = 'completed_at'
  ) THEN
    ALTER TABLE audit_executions ADD COLUMN completed_at TIMESTAMPTZ;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'audit_executions' AND column_name = 'findings_count'
  ) THEN
    ALTER TABLE audit_executions ADD COLUMN findings_count INT NOT NULL DEFAULT 0;
  END IF;
END $$;

-- ==================== audit_findings ====================
-- 066 keyed it on report_id NOT NULL; internal/security keys it on
-- execution_id and never writes report_id, so the constraint would reject every
-- audit finding. 577 already added resolution and target for
-- security-compliance.

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'audit_findings' AND column_name = 'execution_id'
  ) THEN
    ALTER TABLE audit_findings ADD COLUMN execution_id VARCHAR(64);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'audit_findings' AND column_name = 'category'
  ) THEN
    ALTER TABLE audit_findings ADD COLUMN category VARCHAR(64);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'audit_findings' AND column_name = 'evidence'
  ) THEN
    ALTER TABLE audit_findings ADD COLUMN evidence JSONB;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'audit_findings' AND column_name = 'recommendation'
  ) THEN
    ALTER TABLE audit_findings ADD COLUMN recommendation TEXT;
  END IF;
END $$;

-- assigned_to is what Service.ExecuteAudit writes: CreateAuditFinding INSERTs
-- it for every finding the audit produces, so with no runnable DDL every audit
-- execution failed at the first finding with 'column assigned_to does not
-- exist'. (security_findings already has its own assigned_to in the CREATE
-- TABLE above; this ALTER is only for audit_findings, which 066 owns.)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'audit_findings' AND column_name = 'assigned_to'
  ) THEN
    ALTER TABLE audit_findings ADD COLUMN assigned_to VARCHAR(128);
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'audit_findings'
      AND column_name = 'report_id' AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE audit_findings ALTER COLUMN report_id DROP NOT NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_audit_findings_execution ON audit_findings(execution_id);

-- ==================== compliance_policies ====================
-- 066 created it with (id, tenant_id, name, framework, rules TEXT, status,
-- created_at, updated_at). internal/security additionally needs description,
-- framework_type, requirements, severity_threshold and enabled, and never
-- supplies the NOT NULL framework column, so it needs a default.

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'compliance_policies' AND column_name = 'description'
  ) THEN
    ALTER TABLE compliance_policies ADD COLUMN description TEXT;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'compliance_policies' AND column_name = 'framework_type'
  ) THEN
    ALTER TABLE compliance_policies ADD COLUMN framework_type VARCHAR(64);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'compliance_policies' AND column_name = 'requirements'
  ) THEN
    ALTER TABLE compliance_policies ADD COLUMN requirements JSONB NOT NULL DEFAULT '{}';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'compliance_policies' AND column_name = 'severity_threshold'
  ) THEN
    ALTER TABLE compliance_policies ADD COLUMN severity_threshold VARCHAR(16) NOT NULL DEFAULT 'high';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'compliance_policies' AND column_name = 'enabled'
  ) THEN
    ALTER TABLE compliance_policies ADD COLUMN enabled BOOLEAN NOT NULL DEFAULT true;
  END IF;
END $$;

DO $$ BEGIN
  IF (SELECT column_default FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'compliance_policies'
        AND column_name = 'framework') IS NULL THEN
    ALTER TABLE compliance_policies ALTER COLUMN framework SET DEFAULT 'security';
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_compliance_policies_framework_type ON compliance_policies(tenant_id, framework_type);
