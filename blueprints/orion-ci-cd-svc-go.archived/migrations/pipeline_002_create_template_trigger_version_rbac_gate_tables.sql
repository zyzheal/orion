-- Migration 002: Templates, Triggers, Versions, RBAC, Approval Gates

-- Pipeline templates
CREATE TABLE IF NOT EXISTS pipeline_templates (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id     UUID NOT NULL,
    name          VARCHAR(255) NOT NULL,
    description   TEXT,
    category      VARCHAR(100),
    yaml_config   TEXT NOT NULL,
    config        JSONB DEFAULT '{}',
    variables     JSONB DEFAULT '[]',
    is_public     BOOLEAN DEFAULT false,
    usage_count   INT DEFAULT 0,
    created_by    VARCHAR(255),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_templates_tenant ON pipeline_templates(tenant_id);
CREATE INDEX idx_templates_public ON pipeline_templates(is_public) WHERE is_public = true;

-- Pipeline triggers
CREATE TABLE IF NOT EXISTS pipeline_triggers (
    id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    pipeline_id      UUID NOT NULL REFERENCES pipelines(id) ON DELETE CASCADE,
    tenant_id        UUID NOT NULL,
    type             VARCHAR(50) NOT NULL,
    name             VARCHAR(255) NOT NULL,
    enabled          BOOLEAN DEFAULT true,
    config           JSONB DEFAULT '{}',
    secret           VARCHAR(255),
    path_filter      TEXT,
    branch_filter    TEXT,
    last_triggered_at TIMESTAMPTZ,
    trigger_count    INT DEFAULT 0,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_triggers_pipeline ON pipeline_triggers(pipeline_id);
CREATE INDEX idx_triggers_type ON pipeline_triggers(type) WHERE enabled = true;

-- Pipeline versions
CREATE TABLE IF NOT EXISTS pipeline_versions (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    pipeline_id   UUID NOT NULL REFERENCES pipelines(id) ON DELETE CASCADE,
    tenant_id     UUID NOT NULL,
    version       VARCHAR(50) NOT NULL,
    yaml_config   TEXT NOT NULL,
    config        JSONB DEFAULT '{}',
    changelog     TEXT,
    is_active     BOOLEAN DEFAULT false,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_versions_pipeline ON pipeline_versions(pipeline_id);
CREATE INDEX idx_versions_active ON pipeline_versions(pipeline_id, is_active) WHERE is_active = true;

-- Pipeline RBAC
CREATE TABLE IF NOT EXISTS pipeline_rbac (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    pipeline_id   UUID NOT NULL REFERENCES pipelines(id) ON DELETE CASCADE,
    tenant_id     UUID NOT NULL,
    user_id       VARCHAR(255) NOT NULL,
    role          VARCHAR(50) NOT NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(pipeline_id, user_id)
);

CREATE INDEX idx_rbac_pipeline ON pipeline_rbac(pipeline_id);
CREATE INDEX idx_rbac_user ON pipeline_rbac(user_id);

-- Approval gates
CREATE TABLE IF NOT EXISTS approval_gates (
    id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    run_id             UUID NOT NULL REFERENCES pipeline_runs(id),
    stage_id           UUID NOT NULL REFERENCES stages(id),
    pipeline_id        UUID NOT NULL REFERENCES pipelines(id),
    status             VARCHAR(30) NOT NULL DEFAULT 'pending',
    required_approvals INT NOT NULL DEFAULT 1,
    current_approvals  INT NOT NULL DEFAULT 0,
    approvers          JSONB NOT NULL DEFAULT '[]',
    approved_by        VARCHAR(255),
    approved_at        TIMESTAMPTZ,
    rejected_by        VARCHAR(255),
    rejected_at        TIMESTAMPTZ,
    comments           TEXT,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_gates_run ON approval_gates(run_id);
CREATE INDEX idx_gates_stage ON approval_gates(stage_id);
CREATE INDEX idx_gates_status ON approval_gates(status);
