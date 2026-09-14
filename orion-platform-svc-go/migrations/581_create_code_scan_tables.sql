-- Migration 581: code scan tables for internal/code-scan
--
-- internal/code-scan had no runnable DDL anywhere: there is no code_scan_*
-- file under migrations/ and nothing under the migrations/<dir>/
-- subdirectories that the runner never reads. The module also had no
-- repository layer at all -- its handler answered GET /security/code-scan/
-- scans and /findings from a hardcoded sample set, POST /scans never wrote a
-- row, and POST /scans/:id/run invented an id from the URL. Nothing was
-- persisted, so no DDL existed to fix.
--
-- 581 creates the two tables the module now has a repository for. They are new
-- tables owned by this module alone, so CREATE TABLE IF NOT EXISTS is enough
-- and no ALTER is needed: no other migration adds columns to them.
--
-- The runner already wraps each file in its own transaction, so a literal
-- BEGIN;/COMMIT; here would commit the runner's transaction early and make
-- tx.Commit() fail with 'pq: unexpected transaction status idle'.

CREATE TABLE IF NOT EXISTS code_scan_runs (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL,
    target VARCHAR(1024) NOT NULL,
    branch VARCHAR(128) NOT NULL DEFAULT 'main',
    status VARCHAR(16) NOT NULL DEFAULT 'pending',
    total_vulns INT NOT NULL DEFAULT 0,
    critical_count INT NOT NULL DEFAULT 0,
    high_count INT NOT NULL DEFAULT 0,
    medium_count INT NOT NULL DEFAULT 0,
    low_count INT NOT NULL DEFAULT 0,
    duration_sec INT NOT NULL DEFAULT 0,
    error TEXT,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- The page lists newest first; the id tie-break makes an equal created_at
-- (a batch of runs created in the same second) still order deterministically.
CREATE INDEX IF NOT EXISTS idx_code_scan_runs_tenant ON code_scan_runs(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_code_scan_runs_status ON code_scan_runs(tenant_id, status);

CREATE TABLE IF NOT EXISTS code_scan_findings (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL,
    scan_id VARCHAR(64) NOT NULL,
    category VARCHAR(64) NOT NULL,
    severity VARCHAR(16) NOT NULL DEFAULT 'medium',
    file_path VARCHAR(1024) NOT NULL,
    line INT NOT NULL DEFAULT 0,
    description TEXT NOT NULL,
    fix TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_code_scan_findings_tenant ON code_scan_findings(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_code_scan_findings_scan ON code_scan_findings(scan_id);
CREATE INDEX IF NOT EXISTS idx_code_scan_findings_severity ON code_scan_findings(tenant_id, severity);
