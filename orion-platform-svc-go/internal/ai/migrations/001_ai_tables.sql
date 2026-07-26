-- ============================================================
-- AI Module Database Migration
-- ============================================================
-- Requires: PostgreSQL 14+ with pg_trgm extension
-- ============================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- ============================================================
-- 1. AI Models (core ai/models)
-- ============================================================
CREATE TABLE IF NOT EXISTS ai_models (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    type        TEXT NOT NULL,
    tenant_id   TEXT NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ai_models_tenant ON ai_models(tenant_id);

-- ============================================================
-- 2. LLM Traces (ai/llm)
-- ============================================================
CREATE TABLE IF NOT EXISTS llm_traces (
    id                   BIGSERIAL PRIMARY KEY,
    trace_id             TEXT NOT NULL UNIQUE,
    tenant_id            TEXT NOT NULL,
    user_id              TEXT,
    scenario_id          TEXT,
    provider_id          TEXT,
    model_id             TEXT NOT NULL,
    prompt_content       TEXT,
    prompt_hash          TEXT,
    output_content       TEXT,
    output_hash          TEXT,
    input_tokens         BIGINT DEFAULT 0,
    output_tokens        BIGINT DEFAULT 0,
    total_tokens         BIGINT DEFAULT 0,
    input_cost           DOUBLE PRECISION DEFAULT 0,
    output_cost          DOUBLE PRECISION DEFAULT 0,
    total_cost           DOUBLE PRECISION DEFAULT 0,
    currency             TEXT DEFAULT 'CNY',
    status               TEXT DEFAULT 'pending',
    request_started_at   TIMESTAMPTZ NOT NULL,
    request_completed_at TIMESTAMPTZ,
    duration_ms          BIGINT,
    parent_trace_id      TEXT,
    error_message        TEXT,
    request_context      JSONB DEFAULT '{}',
    metadata             JSONB DEFAULT '{}',
    created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_llm_traces_tenant ON llm_traces(tenant_id);
CREATE INDEX IF NOT EXISTS idx_llm_traces_trace_id ON llm_traces(trace_id);

-- ============================================================
-- 3. Model Custom Pricing (ai/llm)
-- ============================================================
CREATE TABLE IF NOT EXISTS model_custom_pricing (
    id           TEXT PRIMARY KEY,
    model_id     TEXT NOT NULL,
    input_price  DOUBLE PRECISION NOT NULL,
    output_price DOUBLE PRECISION NOT NULL,
    tenant_id    TEXT,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_model_pricing_model ON model_custom_pricing(model_id);

-- ============================================================
-- 4. AI Agent Audit Logs (ai/aiagent)
-- ============================================================
CREATE TABLE IF NOT EXISTS ai_agent_audit_logs (
    id         TEXT PRIMARY KEY,
    agent_id   TEXT NOT NULL,
    tenant_id  TEXT NOT NULL,
    action     TEXT NOT NULL,
    input      JSONB DEFAULT '{}',
    output     JSONB DEFAULT '{}',
    status     TEXT NOT NULL DEFAULT 'pending',
    error      TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_agent_audit_agent ON ai_agent_audit_logs(agent_id);

-- ============================================================
-- 5. AI Cost Savings (ai/aicost)
-- ============================================================
CREATE TABLE IF NOT EXISTS ai_cost_savings (
    id          TEXT PRIMARY KEY,
    tenant_id   TEXT NOT NULL,
    amount      DOUBLE PRECISION NOT NULL DEFAULT 0,
    category    TEXT NOT NULL,
    description TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_cost_savings_tenant ON ai_cost_savings(tenant_id);

-- ============================================================
-- 6. AI Gateways (ai/aigateway)
-- ============================================================
CREATE TABLE IF NOT EXISTS ai_gateways (
    id         TEXT PRIMARY KEY,
    tenant_id  TEXT NOT NULL,
    name       TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 7. AI Reviews (ai/aireview)
-- ============================================================
CREATE TABLE IF NOT EXISTS ai_reviews (
    id         TEXT PRIMARY KEY,
    tenant_id  TEXT NOT NULL,
    name       TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 8. AI Security (ai/aisecurity)
-- ============================================================
CREATE TABLE IF NOT EXISTS ai_security (
    id         TEXT PRIMARY KEY,
    tenant_id  TEXT NOT NULL,
    name       TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 9. Knowledge Bases (ai/knowledge)
-- ============================================================
CREATE TABLE IF NOT EXISTS knowledge_bases (
    id              TEXT PRIMARY KEY,
    tenant_id       TEXT NOT NULL,
    name            TEXT NOT NULL,
    description     TEXT DEFAULT '',
    is_enabled      BOOLEAN DEFAULT TRUE,
    embedding_model TEXT DEFAULT 'text-embedding-3-small',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_kb_tenant ON knowledge_bases(tenant_id);

CREATE TABLE IF NOT EXISTS knowledge_documents (
    id         TEXT PRIMARY KEY,
    base_id    TEXT NOT NULL REFERENCES knowledge_bases(id) ON DELETE CASCADE,
    title      TEXT NOT NULL,
    content    TEXT NOT NULL,
    embedding  TEXT DEFAULT '[]',
    metadata   TEXT DEFAULT '',
    status     TEXT DEFAULT 'pending',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_kd_base ON knowledge_documents(base_id);

-- ============================================================
-- 10. Orchestrations (ai/orchestration)
-- ============================================================
CREATE TABLE IF NOT EXISTS orchestrations (
    id          TEXT PRIMARY KEY,
    tenant_id   TEXT NOT NULL,
    name        TEXT NOT NULL,
    description TEXT DEFAULT '',
    agents      JSONB DEFAULT '[]',
    status      TEXT DEFAULT 'active',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_orch_tenant ON orchestrations(tenant_id);

CREATE TABLE IF NOT EXISTS orchestration_runs (
    id               TEXT PRIMARY KEY,
    orchestration_id TEXT NOT NULL REFERENCES orchestrations(id) ON DELETE CASCADE,
    status           TEXT DEFAULT 'pending',
    input            TEXT DEFAULT '',
    output           TEXT DEFAULT '',
    error            TEXT DEFAULT '',
    started_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at     TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_orch_runs_orch ON orchestration_runs(orchestration_id);

-- ============================================================
-- 11. Auto-Recovery (ai/auto-recovery)
-- ============================================================
CREATE TABLE IF NOT EXISTS auto_recovery_rules (
    id          TEXT PRIMARY KEY,
    tenant_id   TEXT NOT NULL,
    name        TEXT NOT NULL,
    description TEXT DEFAULT '',
    trigger     TEXT NOT NULL,
    condition   TEXT NOT NULL,
    action      TEXT NOT NULL,
    target      TEXT NOT NULL,
    is_enabled  BOOLEAN DEFAULT TRUE,
    max_retries INT DEFAULT 3,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_arr_tenant ON auto_recovery_rules(tenant_id);

CREATE TABLE IF NOT EXISTS recovery_actions (
    id           TEXT PRIMARY KEY,
    rule_id      TEXT NOT NULL REFERENCES auto_recovery_rules(id) ON DELETE CASCADE,
    tenant_id    TEXT NOT NULL,
    action       TEXT NOT NULL,
    target       TEXT NOT NULL,
    status       TEXT DEFAULT 'pending',
    result       TEXT DEFAULT '',
    retry_count  INT DEFAULT 0,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_ra_rule ON recovery_actions(rule_id);

-- ============================================================
-- 12. Skill Packages (ai/skill)
-- ============================================================
CREATE TABLE IF NOT EXISTS skill_packages (
    id                TEXT PRIMARY KEY,
    name              TEXT NOT NULL UNIQUE,
    version           TEXT NOT NULL,
    description       TEXT DEFAULT '',
    category          TEXT DEFAULT 'general',
    tags              TEXT[] DEFAULT '{}',
    author            TEXT NOT NULL,
    status            TEXT DEFAULT 'draft',
    schema            JSONB DEFAULT '{}',
    capabilities      TEXT[] DEFAULT '{}',
    schemas           JSONB DEFAULT '{}',
    is_version_locked BOOLEAN DEFAULT FALSE,
    install_count     INT DEFAULT 0,
    rating            DOUBLE PRECISION DEFAULT 0,
    rating_count      INT DEFAULT 0,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_skill_status ON skill_packages(status);

CREATE TABLE IF NOT EXISTS skill_versions (
    id              TEXT PRIMARY KEY,
    skill_id        TEXT NOT NULL REFERENCES skill_packages(id) ON DELETE CASCADE,
    version         TEXT NOT NULL,
    changelog       TEXT,
    schema          JSONB DEFAULT '{}',
    schema_snapshot JSONB DEFAULT '{}',
    is_latest       BOOLEAN DEFAULT TRUE,
    is_locked       BOOLEAN DEFAULT FALSE,
    released_at     TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_skill_ver_skill ON skill_versions(skill_id);

CREATE TABLE IF NOT EXISTS skill_instances (
    id          TEXT PRIMARY KEY,
    skill_id    TEXT NOT NULL REFERENCES skill_packages(id) ON DELETE CASCADE,
    tenant_id   TEXT NOT NULL,
    project_id  TEXT,
    name        TEXT NOT NULL,
    description TEXT,
    status      TEXT DEFAULT 'inactive',
    config      JSONB DEFAULT '{}',
    bindings    JSONB DEFAULT '{}',
    metadata    JSONB DEFAULT '{}',
    is_default  BOOLEAN DEFAULT FALSE,
    version     TEXT DEFAULT '1.0.0',
    created_by  TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_skill_inst_skill ON skill_instances(skill_id);
CREATE INDEX IF NOT EXISTS idx_skill_inst_tenant ON skill_instances(tenant_id);

CREATE TABLE IF NOT EXISTS skill_reviews (
    id         TEXT PRIMARY KEY,
    skill_id   TEXT NOT NULL REFERENCES skill_packages(id) ON DELETE CASCADE,
    user_id    TEXT NOT NULL,
    rating     INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
    comment    TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS skill_executions (
    id            TEXT PRIMARY KEY,
    tenant_id     TEXT NOT NULL,
    skill_id      TEXT NOT NULL,
    instance_id   TEXT,
    capability    TEXT,
    status        TEXT DEFAULT 'pending',
    input         JSONB DEFAULT '{}',
    output        JSONB DEFAULT '{}',
    error_message TEXT,
    duration_ms   BIGINT,
    triggered_by  TEXT,
    trigger_mode  TEXT DEFAULT 'manual',
    metadata      JSONB DEFAULT '{}',
    started_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at  TIMESTAMPTZ,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_skill_exec_skill ON skill_executions(skill_id);

CREATE TABLE IF NOT EXISTS skill_audit_logs (
    id         TEXT PRIMARY KEY,
    skill_id   TEXT NOT NULL,
    action     TEXT NOT NULL,
    actor_id   TEXT,
    actor_name TEXT,
    old_status TEXT,
    new_status TEXT,
    reason     TEXT,
    changes    JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_skill_audit_skill ON skill_audit_logs(skill_id);

-- ============================================================
-- 13. Intelligence Tasks (ai/intelligence)
-- ============================================================
CREATE TABLE IF NOT EXISTS intelligence_tasks (
    id           TEXT PRIMARY KEY,
    tenant_id    TEXT NOT NULL,
    name         TEXT NOT NULL,
    insight_type TEXT NOT NULL,
    source       TEXT NOT NULL,
    confidence   DOUBLE PRECISION DEFAULT 0,
    data         JSONB DEFAULT '{}',
    status       TEXT DEFAULT 'pending',
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_intel_task_tenant ON intelligence_tasks(tenant_id);
