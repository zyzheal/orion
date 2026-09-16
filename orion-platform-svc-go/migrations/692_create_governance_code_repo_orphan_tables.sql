-- 692_create_governance_code_repo_orphan_tables.sql
--
-- Missing DDL for the 10 governance + code-repo orphan tables that
-- internal/governance and internal/code-repo repositories reference but no
-- earlier migration creates. Inventory: docs/orphan-tables-inventory-2026-09-16.md.
--
-- Column shapes read from each repository's INSERT/SELECT column lists and the
-- module's db tags. Notes:
--   * api_inventory.api_data, api_versions.definition, governance_rules.config,
--     api_contract_violations.sample_data are JSONB (bound via JSONB marshal /
--     mustJSON cast).
--   * compliance_remediations INSERT does `RETURNING created_at, updated_at`,
--     so the updated_at column exists even though no INSERT names it.
--   * code-repo tables are read-only in the repository (SELECT only; the
--     source-control adapters populate them out-of-band), so the DDL here
--     only needs to cover the exact SELECTed columns. Composite PKs use the
--     natural key (adapter_id + repo_id / sha) where SELECTs filter on them.
--   * code_repo_codeowners / code_repo_webhook_logs queries reference repo_id
--     as the join key and ORDER BY pattern / created_at.
--
-- Idempotent by construction (IF NOT EXISTS).

CREATE TABLE IF NOT EXISTS api_inventory (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    api_path VARCHAR(1024) NOT NULL,
    api_data JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_api_inventory_tenant ON api_inventory(tenant_id, api_path);

CREATE TABLE IF NOT EXISTS api_versions (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    contract_id VARCHAR(36),
    api_id VARCHAR(36),
    version_tag VARCHAR(128),
    version VARCHAR(128) NOT NULL,
    definition JSONB DEFAULT '{}'::jsonb,
    status VARCHAR(32) DEFAULT 'active',
    deprecation_date TIMESTAMPTZ,
    retirement_date TIMESTAMPTZ,
    replacement_version VARCHAR(128),
    changelog TEXT
);

CREATE INDEX IF NOT EXISTS idx_api_versions_tenant ON api_versions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_api_versions_contract ON api_versions(contract_id, api_id);

CREATE TABLE IF NOT EXISTS api_contract_violations (
    id VARCHAR(36) PRIMARY KEY,
    contract_id VARCHAR(36) NOT NULL,
    violation_type VARCHAR(128),
    description TEXT,
    severity VARCHAR(32) DEFAULT 'warning',
    detected_at TIMESTAMPTZ DEFAULT NOW(),
    sample_data JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_api_contract_violations_contract ON api_contract_violations(contract_id);

CREATE TABLE IF NOT EXISTS governance_rules (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    rule_type VARCHAR(64) NOT NULL,
    config JSONB DEFAULT '{}'::jsonb,
    enabled BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_governance_rules_tenant ON governance_rules(tenant_id);
CREATE INDEX IF NOT EXISTS idx_governance_rules_type ON governance_rules(rule_type);

CREATE TABLE IF NOT EXISTS compliance_remediations (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    evaluation_id VARCHAR(36) NOT NULL,
    gap_id VARCHAR(128) NOT NULL,
    status VARCHAR(32) DEFAULT 'pending',
    action_taken TEXT,
    result TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_compliance_remediations_tenant ON compliance_remediations(tenant_id, evaluation_id);
CREATE INDEX IF NOT EXISTS idx_compliance_remediations_status ON compliance_remediations(status);

CREATE TABLE IF NOT EXISTS code_repo_repos (
    adapter_id VARCHAR(64) NOT NULL,
    repo_id VARCHAR(128) NOT NULL,
    name VARCHAR(255) NOT NULL,
    full_name VARCHAR(512),
    url VARCHAR(1024),
    is_private BOOLEAN DEFAULT FALSE,
    default_branch VARCHAR(128),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (adapter_id, repo_id)
);

CREATE INDEX IF NOT EXISTS idx_code_repo_repos_name ON code_repo_repos(name);

CREATE TABLE IF NOT EXISTS code_repo_commits (
    sha VARCHAR(64),
    adapter_id VARCHAR(64),
    repo_id VARCHAR(128),
    message TEXT,
    author VARCHAR(255),
    committer VARCHAR(255),
    date TIMESTAMPTZ,
    url VARCHAR(1024),
    parents JSONB DEFAULT '[]'::jsonb,
    added JSONB DEFAULT '[]'::jsonb,
    modified JSONB DEFAULT '[]'::jsonb,
    removed JSONB DEFAULT '[]'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_code_repo_commits_key ON code_repo_commits(adapter_id, repo_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_code_repo_commits_sha ON code_repo_commits(sha);

CREATE TABLE IF NOT EXISTS code_repo_diffs (
    id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    adapter_id VARCHAR(64),
    repo_id VARCHAR(128),
    base VARCHAR(128),
    head VARCHAR(128),
    filename VARCHAR(1024),
    status VARCHAR(32),
    old_filename VARCHAR(1024),
    patch TEXT
);

CREATE INDEX IF NOT EXISTS idx_code_repo_diffs_key ON code_repo_diffs(adapter_id, repo_id, base, head);

CREATE TABLE IF NOT EXISTS code_repo_codeowners (
    id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    repo_id VARCHAR(128),
    pattern VARCHAR(1024) NOT NULL,
    owners JSONB DEFAULT '[]'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_code_repo_codeowners_repo ON code_repo_codeowners(repo_id, pattern);

CREATE TABLE IF NOT EXISTS code_repo_webhook_logs (
    id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    repo_id VARCHAR(128),
    event_type VARCHAR(128),
    status VARCHAR(32),
    url VARCHAR(1024),
    payload JSONB DEFAULT '{}'::jsonb,
    response TEXT,
    attempts INT DEFAULT 0,
    tenant_id VARCHAR(36),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    delivered_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_code_repo_webhook_logs_repo ON code_repo_webhook_logs(repo_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_code_repo_webhook_logs_tenant ON code_repo_webhook_logs(tenant_id);