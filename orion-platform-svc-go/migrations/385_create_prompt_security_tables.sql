-- Migration 385: prompt-security tables (was AutoMigrate only)

CREATE TABLE IF NOT EXISTS prompt_security_configs (
    id BIGSERIAL PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    is_enabled BOOLEAN DEFAULT TRUE,
    injection_detection BOOLEAN DEFAULT TRUE,
    pii_detection BOOLEAN DEFAULT TRUE,
    max_prompt_length INT DEFAULT 10000,
    blocked_patterns TEXT DEFAULT 'ignore previous,disregard,discard,forget',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_prompt_security_configs_tenant ON prompt_security_configs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_prompt_security_configs_enabled ON prompt_security_configs(is_enabled);

CREATE TABLE IF NOT EXISTS prompt_security_scans (
    id BIGSERIAL PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    prompt_preview TEXT DEFAULT '',
    score DOUBLE PRECISION DEFAULT 0,
    is_safe BOOLEAN DEFAULT TRUE,
    findings JSONB DEFAULT '[]',
    severity INT DEFAULT 0,
    injection_detected BOOLEAN DEFAULT FALSE,
    pii_detected BOOLEAN DEFAULT FALSE,
    scan_time_ms INT DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_prompt_security_scans_tenant ON prompt_security_scans(tenant_id);
CREATE INDEX IF NOT EXISTS idx_prompt_security_scans_severity ON prompt_security_scans(severity);
CREATE INDEX IF NOT EXISTS idx_prompt_security_scans_created ON prompt_security_scans(created_at DESC);