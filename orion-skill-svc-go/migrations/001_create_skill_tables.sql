-- 001_create_skill_tables.sql
-- Skill microservice schema: packages, versions, instances, reviews, executions, audit logs

-- ============================================================
-- skill_packages: global skill catalog (no tenant_id — tenants bind via instances)
-- ============================================================
CREATE TABLE IF NOT EXISTS skill_packages (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            VARCHAR(256)  NOT NULL,
    version         VARCHAR(32)   NOT NULL DEFAULT '0.1.0',
    description     TEXT          NOT NULL DEFAULT '',
    category        VARCHAR(64)   NOT NULL DEFAULT 'general',
    tags            TEXT[]        NOT NULL DEFAULT '{}',
    author          VARCHAR(128)  NOT NULL DEFAULT '',
    status          VARCHAR(32)   NOT NULL DEFAULT 'draft',      -- draft|review|published|uninstalled
    schema          JSONB         NOT NULL DEFAULT '{}',
    capabilities    TEXT[],                                      -- e.g. {"ai.code-gen","ai.code-review"}
    schemas         JSONB,                                       -- extended schema definitions
    is_version_locked BOOLEAN      NOT NULL DEFAULT false,
    install_count   INT           NOT NULL DEFAULT 0,
    rating          NUMERIC(3,2)  NOT NULL DEFAULT 0.00,
    rating_count    INT           NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_skill_packages_status     ON skill_packages(status);
CREATE INDEX IF NOT EXISTS idx_skill_packages_category   ON skill_packages(category);
CREATE INDEX IF NOT EXISTS idx_skill_packages_name       ON skill_packages(name);

-- ============================================================
-- skill_versions: immutable version history per skill
-- ============================================================
CREATE TABLE IF NOT EXISTS skill_versions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    skill_id        UUID          NOT NULL REFERENCES skill_packages(id) ON DELETE CASCADE,
    version         VARCHAR(32)   NOT NULL,
    changelog       TEXT,
    schema          JSONB         NOT NULL DEFAULT '{}',
    schema_snapshot JSONB,
    is_latest       BOOLEAN       NOT NULL DEFAULT false,
    is_locked       BOOLEAN       NOT NULL DEFAULT false,
    released_at     TIMESTAMPTZ,
    created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_skill_versions_skill ON skill_versions(skill_id, created_at DESC);

-- ============================================================
-- skill_instances: tenant-scoped instance of a skill package
-- ============================================================
CREATE TABLE IF NOT EXISTS skill_instances (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    skill_id        UUID          NOT NULL REFERENCES skill_packages(id) ON DELETE CASCADE,
    tenant_id       VARCHAR(64)   NOT NULL,
    project_id      VARCHAR(64),
    name            VARCHAR(256)  NOT NULL,
    description     TEXT,
    status          VARCHAR(32)   NOT NULL DEFAULT 'inactive',   -- inactive|active|disabled
    config          JSONB         NOT NULL DEFAULT '{}',
    bindings        JSONB         NOT NULL DEFAULT '{}',
    metadata        JSONB         NOT NULL DEFAULT '{}',
    is_default      BOOLEAN       NOT NULL DEFAULT false,
    version         VARCHAR(32)   NOT NULL DEFAULT '1.0.0',
    created_by      VARCHAR(128),
    created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_skill_instances_tenant ON skill_instances(tenant_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_skill_instances_skill  ON skill_instances(skill_id, tenant_id);

-- ============================================================
-- skill_reviews: user reviews for skill packages
-- ============================================================
CREATE TABLE IF NOT EXISTS skill_reviews (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    skill_id        UUID          NOT NULL REFERENCES skill_packages(id) ON DELETE CASCADE,
    user_id         VARCHAR(128)  NOT NULL,
    rating          SMALLINT      NOT NULL CHECK (rating >= 1 AND rating <= 5),
    comment         TEXT,
    created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    UNIQUE(skill_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_skill_reviews_skill ON skill_reviews(skill_id, created_at DESC);

-- ============================================================
-- skill_executions: execution records for skill invocations
-- ============================================================
CREATE TABLE IF NOT EXISTS skill_executions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       VARCHAR(64)   NOT NULL,
    skill_id        UUID          NOT NULL REFERENCES skill_packages(id) ON DELETE CASCADE,
    instance_id     UUID          REFERENCES skill_instances(id) ON DELETE SET NULL,
    capability      VARCHAR(128),
    status          VARCHAR(32)   NOT NULL DEFAULT 'pending',   -- pending|running|completed|failed
    input           JSONB         NOT NULL DEFAULT '{}',
    output          JSONB,
    error_message   TEXT,
    duration_ms     INT,
    triggered_by    VARCHAR(128),
    trigger_mode    VARCHAR(32)   NOT NULL DEFAULT 'manual',    -- manual|scheduled|api
    metadata        JSONB         NOT NULL DEFAULT '{}',
    started_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    completed_at    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_skill_executions_skill  ON skill_executions(skill_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_skill_executions_tenant ON skill_executions(tenant_id, started_at DESC);

-- ============================================================
-- skill_audit_logs: lifecycle audit trail
-- ============================================================
CREATE TABLE IF NOT EXISTS skill_audit_logs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    skill_id        UUID          NOT NULL REFERENCES skill_packages(id) ON DELETE CASCADE,
    action          VARCHAR(64)   NOT NULL,                      -- created|submitted|approved|rejected|archived|executed
    actor_id        VARCHAR(128),
    actor_name      VARCHAR(128),
    old_status      VARCHAR(32),
    new_status      VARCHAR(32),
    reason          TEXT,
    changes         JSONB,
    created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_skill_audit_logs_skill ON skill_audit_logs(skill_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_skill_audit_logs_action ON skill_audit_logs(action, created_at DESC);
