-- 689_create_ai_domain_orphan_tables.sql
--
-- Missing DDL for the 14 ai-domain tables that internal/ai/* repositories
-- reference but no earlier migration creates. Inventory: docs/orphan-tables-inventory-2026-09-16.md.
--
-- Column shapes are read from each repository's INSERT column list and the
-- module's db tags, not chosen. Notes:
--   * ai_models / ai_canary_configs write created_at, updated_at, start_time,
--     duration as unixNow() epoch seconds (int64), so those columns are BIGINT
--     with NO default -- the call site binds the value explicitly.
--   * Every other table binds created_at/updated_at explicitly with
--     time.Now()/NOW(), so DEFAULT NOW() is only a fallback, not load-bearing.
--   * ai_agent_audit_logs.context/input/output, ai_agents.*required* tools and
--     model_config, intelligence_tasks.data, orchestrations.agents,
--     skill_packages.schema/schemas are JSONB (the repositories cast
--     ::jsonb on bind).
--   * ai_review is queried with `deleted_at IS NULL`, so the column exists
--     even though no INSERT writes it.
--   * model_custom_pricing is upserted with RETURNING * and read back through
--     StructScan, so every db-tagged model field is a real column.
--
-- Idempotent by construction (IF NOT EXISTS) like the rest of the run.

CREATE TABLE IF NOT EXISTS ai_agents (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    name VARCHAR(255) NOT NULL,
    enabled BOOLEAN DEFAULT TRUE,
    scenario VARCHAR(255),
    provider VARCHAR(255),
    max_concurrency INT DEFAULT 1,
    timeout_ms INT DEFAULT 60000,
    max_retries INT DEFAULT 3,
    backoff_ms INT DEFAULT 1000,
    required_tools JSONB DEFAULT '[]'::jsonb,
    required_permissions JSONB DEFAULT '[]'::jsonb,
    model_config JSONB,
    status VARCHAR(64) DEFAULT 'idle',
    created_by VARCHAR(64),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_agents_tenant ON ai_agents(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ai_agents_status ON ai_agents(status);

CREATE TABLE IF NOT EXISTS ai_agent_audit_logs (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    agent_id VARCHAR(36) NOT NULL,
    context JSONB,
    input JSONB,
    output JSONB,
    duration_ms INT,
    input_tokens INT,
    output_tokens INT,
    total_tokens INT,
    success BOOLEAN DEFAULT TRUE,
    error TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_agent_audit_tenant ON ai_agent_audit_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ai_agent_audit_agent ON ai_agent_audit_logs(agent_id, created_at DESC);

CREATE TABLE IF NOT EXISTS ai_models (
    id VARCHAR(36) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    display_name VARCHAR(255),
    description TEXT,
    type VARCHAR(64) DEFAULT 'llm',
    status VARCHAR(64) DEFAULT 'active',
    framework VARCHAR(128),
    current_version VARCHAR(128),
    tags TEXT DEFAULT '[]',
    metadata TEXT DEFAULT '{}',
    created_by VARCHAR(64),
    tenant_id VARCHAR(36),
    created_at BIGINT,
    updated_at BIGINT
);

CREATE INDEX IF NOT EXISTS idx_ai_models_tenant ON ai_models(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ai_models_type_status ON ai_models(type, status);

CREATE TABLE IF NOT EXISTS ai_canary_configs (
    id VARCHAR(36) PRIMARY KEY,
    model_id VARCHAR(36) NOT NULL,
    enabled BOOLEAN DEFAULT FALSE,
    target_version VARCHAR(128),
    traffic_percent DOUBLE PRECISION DEFAULT 0,
    success_threshold DOUBLE PRECISION DEFAULT 0.99,
    latency_threshold DOUBLE PRECISION DEFAULT 2000,
    error_rate_threshold DOUBLE PRECISION DEFAULT 0.01,
    start_time BIGINT,
    duration BIGINT,
    status VARCHAR(64) DEFAULT 'draft',
    current_metrics TEXT,
    tenant_id VARCHAR(36) NOT NULL,
    created_at BIGINT,
    updated_at BIGINT
);

CREATE INDEX IF NOT EXISTS idx_ai_canary_model ON ai_canary_configs(model_id);
CREATE INDEX IF NOT EXISTS idx_ai_canary_tenant ON ai_canary_configs(tenant_id);

CREATE TABLE IF NOT EXISTS ai_cost_records (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    model_id VARCHAR(36),
    prompt_tokens BIGINT DEFAULT 0,
    completion_tokens BIGINT DEFAULT 0,
    cost DOUBLE PRECISION DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_cost_records_tenant ON ai_cost_records(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_cost_records_model ON ai_cost_records(model_id);

CREATE TABLE IF NOT EXISTS ai_cost_savings (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    amount DOUBLE PRECISION DEFAULT 0,
    category VARCHAR(128),
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_cost_savings_tenant ON ai_cost_savings(tenant_id, created_at DESC);

CREATE TABLE IF NOT EXISTS ai_review (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    content TEXT,
    status VARCHAR(64) DEFAULT 'pending',
    score DOUBLE PRECISION,
    suggestions TEXT,
    created_by VARCHAR(64),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_ai_review_tenant ON ai_review(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ai_review_status ON ai_review(status);

CREATE TABLE IF NOT EXISTS ai_security (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_security_tenant ON ai_security(tenant_id);

CREATE TABLE IF NOT EXISTS intelligence_tasks (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    name VARCHAR(255) NOT NULL,
    insight_type VARCHAR(128),
    source VARCHAR(255),
    confidence DOUBLE PRECISION,
    data JSONB,
    status VARCHAR(64) DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_intelligence_tasks_tenant ON intelligence_tasks(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_intelligence_tasks_type ON intelligence_tasks(insight_type);

CREATE TABLE IF NOT EXISTS knowledge_bases (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    is_enabled BOOLEAN DEFAULT TRUE,
    embedding_model VARCHAR(128),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_knowledge_bases_tenant ON knowledge_bases(tenant_id);

CREATE TABLE IF NOT EXISTS model_custom_pricing (
    id VARCHAR(36) PRIMARY KEY,
    model_id VARCHAR(36) NOT NULL,
    input_price DOUBLE PRECISION DEFAULT 0,
    output_price DOUBLE PRECISION DEFAULT 0,
    tenant_id VARCHAR(36) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_model_custom_pricing_tenant ON model_custom_pricing(tenant_id);

CREATE TABLE IF NOT EXISTS orchestrations (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    agents JSONB DEFAULT '[]'::jsonb,
    status VARCHAR(64) DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_orchestrations_tenant ON orchestrations(tenant_id);

CREATE TABLE IF NOT EXISTS orchestration_runs (
    id VARCHAR(36) PRIMARY KEY,
    orchestration_id VARCHAR(36) NOT NULL,
    status VARCHAR(64) DEFAULT 'running',
    input TEXT,
    output TEXT,
    error TEXT,
    started_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_orchestration_runs_orch ON orchestration_runs(orchestration_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_orchestration_runs_status ON orchestration_runs(status);

CREATE TABLE IF NOT EXISTS skill_packages (
    id VARCHAR(36) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    version VARCHAR(64) NOT NULL,
    description TEXT,
    category VARCHAR(128),
    tags JSONB DEFAULT '[]'::jsonb,
    author VARCHAR(128),
    status VARCHAR(64) DEFAULT 'active',
    schema JSONB,
    capabilities JSONB DEFAULT '[]'::jsonb,
    schemas JSONB,
    is_version_locked BOOLEAN DEFAULT FALSE,
    install_count INT DEFAULT 0,
    rating DOUBLE PRECISION DEFAULT 0,
    rating_count INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_skill_packages_name_ver ON skill_packages(name, version);
CREATE INDEX IF NOT EXISTS idx_skill_packages_category ON skill_packages(category);