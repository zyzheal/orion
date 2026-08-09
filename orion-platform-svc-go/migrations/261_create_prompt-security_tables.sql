-- ============================================================
-- Prompt Security Module (P3-12)
-- Prompt injection detection + output audit
-- ============================================================
-- Tables: security_checks
-- ============================================================

CREATE TABLE IF NOT EXISTS security_checks (
    id            UUID NOT NULL DEFAULT gen_random_uuid(),
    tenant_id     UUID NOT NULL,
    check_type    VARCHAR(32) NOT NULL DEFAULT 'prompt',
    prompt_hash   VARCHAR(64) NOT NULL DEFAULT '',
    risk_score    SMALLINT NOT NULL DEFAULT 0,
    is_safe       BOOLEAN NOT NULL DEFAULT TRUE,
    action        VARCHAR(16) NOT NULL DEFAULT 'allow',
    matched_keywords TEXT[] NOT NULL DEFAULT '{}',
    findings      TEXT[] NOT NULL DEFAULT '{}',
    checked_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS idx_sc_tenant ON security_checks(tenant_id);
CREATE INDEX IF NOT EXISTS idx_sc_risk_score ON security_checks(tenant_id, risk_score DESC);
CREATE INDEX IF NOT EXISTS idx_sc_checked_at ON security_checks(checked_at DESC);
CREATE INDEX IF NOT EXISTS idx_sc_prompt_hash ON security_checks(tenant_id, prompt_hash);
