-- 694_create_module_orphan_tables.sql
--
-- Missing DDL for 11 orphan tables across 8 modules that internal/*
-- repositories reference but no earlier migration creates. Group 3 of the
-- orphan inventory: docs/orphan-tables-inventory-2026-09-16.md.
-- Modules: cron, degradation, llm-trace, queue, skill, webhook,
-- gateway-dynamic, crossover.
--
-- Column shapes read from each repository's INSERT/SELECT column lists and the
-- module's db tags. Notes:
--   * llm_traces is a 26-column relation created via NamedExec with
--     request_context and metadata as JSONB (the repository drops ::jsonb
--     casts; postgres casts text to jsonb implicitly on bind of a JSON string).
--   * crossover_calls is created at runtime by the repository's CreateTable();
--     the DDL here mirrors that exact schema so the migration is authoritative
--     and a fresh deployment does not depend on the app calling CreateTable.
--   * skill_versions.changes is JSONB; queue_jobs.payload is text holding a
--     JSON blob (the repository marshals to a string), assigned JSONB here so
--     both string and JSON binds land.
--   * degradation action/trigger config/condition columns are plain TEXT.
--
-- Idempotent by construction (IF NOT EXISTS).

-- ==================== cron ====================

CREATE TABLE IF NOT EXISTS scheduler_job_definitions (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    name VARCHAR(255) NOT NULL,
    cron_expr VARCHAR(128) NOT NULL,
    job_type VARCHAR(64) NOT NULL,
    config JSONB DEFAULT '{}'::jsonb,
    status VARCHAR(32) DEFAULT 'enabled',
    last_run_at TIMESTAMPTZ,
    next_run_at TIMESTAMPTZ,
    max_retries INT DEFAULT 3,
    timeout_sec INT DEFAULT 300,
    enabled BOOLEAN DEFAULT TRUE,
    error TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_scheduler_job_defs_tenant ON scheduler_job_definitions(tenant_id, status);

CREATE TABLE IF NOT EXISTS scheduler_job_execution_logs (
    id VARCHAR(36) PRIMARY KEY,
    job_id VARCHAR(36) NOT NULL,
    status VARCHAR(32) DEFAULT 'running',
    output TEXT,
    error TEXT,
    duration_ms BIGINT DEFAULT 0,
    started_at TIMESTAMPTZ DEFAULT NOW(),
    finished_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_scheduler_job_logs_job ON scheduler_job_execution_logs(job_id, started_at DESC);

-- ==================== degradation ====================

CREATE TABLE IF NOT EXISTS degradation_triggers (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    policy_id VARCHAR(36) NOT NULL,
    status VARCHAR(32) DEFAULT 'active',
    reason TEXT,
    error_rate DOUBLE PRECISION DEFAULT 0,
    latency_ms BIGINT DEFAULT 0,
    triggered_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_degradation_triggers_tenant ON degradation_triggers(tenant_id, status);

CREATE TABLE IF NOT EXISTS degradation_actions (
    id VARCHAR(36) PRIMARY KEY,
    trigger_id VARCHAR(36) NOT NULL,
    tenant_id VARCHAR(36) NOT NULL,
    action VARCHAR(64) NOT NULL,
    detail TEXT,
    status VARCHAR(32) DEFAULT 'applied',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_degradation_actions_tenant ON degradation_actions(tenant_id, trigger_id);

-- ==================== llm-trace ====================

CREATE TABLE IF NOT EXISTS llm_traces (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    user_id VARCHAR(64),
    scenario_id VARCHAR(64),
    provider_id VARCHAR(64),
    model_id VARCHAR(128),
    prompt_content TEXT,
    prompt_hash VARCHAR(128),
    output_content TEXT,
    output_hash VARCHAR(128),
    input_tokens INT DEFAULT 0,
    output_tokens INT DEFAULT 0,
    total_tokens INT DEFAULT 0,
    input_cost DOUBLE PRECISION DEFAULT 0,
    output_cost DOUBLE PRECISION DEFAULT 0,
    total_cost DOUBLE PRECISION DEFAULT 0,
    currency VARCHAR(16) DEFAULT 'CNY',
    status VARCHAR(32) DEFAULT 'pending',
    request_started_at TIMESTAMPTZ DEFAULT NOW(),
    request_completed_at TIMESTAMPTZ,
    duration_ms BIGINT DEFAULT 0,
    parent_trace_id VARCHAR(36),
    error_message TEXT,
    request_context JSONB DEFAULT '{}'::jsonb,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_llm_traces_tenant ON llm_traces(tenant_id, request_started_at DESC);
CREATE INDEX IF NOT EXISTS idx_llm_traces_model ON llm_traces(model_id);
CREATE INDEX IF NOT EXISTS idx_llm_traces_status ON llm_traces(status);

CREATE TABLE IF NOT EXISTS llm_model_pricing (
    id VARCHAR(36) PRIMARY KEY,
    model_id VARCHAR(128) NOT NULL,
    input DOUBLE PRECISION DEFAULT 0,
    output DOUBLE PRECISION DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_llm_model_pricing_model ON llm_model_pricing(model_id);

-- ==================== queue ====================

CREATE TABLE IF NOT EXISTS queue_jobs (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    queue_name VARCHAR(128) NOT NULL,
    job_type VARCHAR(128) NOT NULL,
    payload JSONB DEFAULT '{}'::jsonb,
    status VARCHAR(32) DEFAULT 'queued',
    priority INT DEFAULT 0,
    attempts INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_queue_jobs_queue ON queue_jobs(tenant_id, queue_name, status);
CREATE INDEX IF NOT EXISTS idx_queue_jobs_priority ON queue_jobs(priority DESC);

-- ==================== skill ====================

CREATE TABLE IF NOT EXISTS skill_versions (
    id VARCHAR(36) PRIMARY KEY,
    skill_id VARCHAR(36) NOT NULL,
    version VARCHAR(64) NOT NULL,
    changes JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_skill_versions_skill ON skill_versions(skill_id, version);

-- ==================== webhook ====================

CREATE TABLE IF NOT EXISTS webhook_config (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    domain VARCHAR(128) NOT NULL,
    name VARCHAR(255) NOT NULL,
    value TEXT,
    enabled BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_webhook_config_domain ON webhook_config(tenant_id, domain);

-- ==================== gateway-dynamic ====================

CREATE TABLE IF NOT EXISTS gateway_gray_release (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    route_id VARCHAR(64) NOT NULL,
    config JSONB DEFAULT '{}'::jsonb,
    enabled BOOLEAN DEFAULT FALSE,
    active_since TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_gateway_gray_release_route ON gateway_gray_release(tenant_id, route_id);

-- ==================== crossover ====================

CREATE TABLE IF NOT EXISTS crossover_calls (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(64) NOT NULL DEFAULT '',
    source_domain VARCHAR(128) NOT NULL DEFAULT '',
    target_domain VARCHAR(128) NOT NULL DEFAULT '',
    method VARCHAR(256) NOT NULL DEFAULT '',
    payload JSONB,
    response JSONB,
    status VARCHAR(32) NOT NULL DEFAULT 'pending',
    duration_ms BIGINT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_crossover_calls_tenant ON crossover_calls (tenant_id);
CREATE INDEX IF NOT EXISTS idx_crossover_calls_created_at ON crossover_calls (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_crossover_calls_status ON crossover_calls (status);
CREATE INDEX IF NOT EXISTS idx_crossover_calls_target ON crossover_calls (target_domain);