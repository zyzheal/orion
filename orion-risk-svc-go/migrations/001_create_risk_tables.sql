-- 001: Risk assessment tables

-- Risk items (basic risk tracking)
CREATE TABLE IF NOT EXISTS risk_items (
    id UUID PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL,
    name VARCHAR(256) NOT NULL,
    risk_type VARCHAR(64) NOT NULL,
    level VARCHAR(16) NOT NULL DEFAULT 'medium',
    description TEXT,
    mitigation TEXT,
    status VARCHAR(32) NOT NULL DEFAULT 'open',
    assignee VARCHAR(128),
    metadata JSONB NOT NULL DEFAULT '{}',
    tags JSONB NOT NULL DEFAULT '[]',
    due_date TIMESTAMPTZ,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_risk_items_tenant ON risk_items(tenant_id, created_at);
CREATE INDEX IF NOT EXISTS idx_risk_items_status ON risk_items(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_risk_items_level ON risk_items(tenant_id, level);

-- Risk assessments (scoring engine output)
CREATE TABLE IF NOT EXISTS risk_assessments (
    id UUID PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL,
    name VARCHAR(256) NOT NULL,
    target_type VARCHAR(64) NOT NULL,
    target_id VARCHAR(256) NOT NULL,
    risk_score DOUBLE PRECISION NOT NULL DEFAULT 0,
    risk_level VARCHAR(16) NOT NULL DEFAULT 'medium',
    factors JSONB NOT NULL DEFAULT '[]',
    recommendations JSONB NOT NULL DEFAULT '[]',
    status VARCHAR(32) NOT NULL DEFAULT 'completed',
    metadata JSONB NOT NULL DEFAULT '{}',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_risk_assessments_tenant ON risk_assessments(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_risk_assessments_target ON risk_assessments(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_risk_assessments_level ON risk_assessments(tenant_id, risk_level);

-- Risk reports (generated from assessments)
CREATE TABLE IF NOT EXISTS risk_reports (
    id UUID PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL,
    assessment_id UUID NOT NULL,
    risk_score DOUBLE PRECISION NOT NULL DEFAULT 0,
    risk_level VARCHAR(16) NOT NULL DEFAULT 'medium',
    can_deploy BOOLEAN NOT NULL DEFAULT false,
    critical_risk_count INT NOT NULL DEFAULT 0,
    summary JSONB NOT NULL DEFAULT '{}',
    details JSONB NOT NULL DEFAULT '{}',
    recommendations JSONB NOT NULL DEFAULT '[]',
    generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_risk_reports_tenant ON risk_reports(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_risk_reports_assessment ON risk_reports(assessment_id);

-- Risk predictions (ML engine cache)
CREATE TABLE IF NOT EXISTS risk_predictions (
    id VARCHAR(256) PRIMARY KEY,
    tenant_id VARCHAR(64),
    target_type VARCHAR(64),
    target_id VARCHAR(256),
    risk_score DOUBLE PRECISION NOT NULL DEFAULT 0,
    risk_level VARCHAR(16) NOT NULL DEFAULT 'low',
    confidence DOUBLE PRECISION,
    model_version VARCHAR(64) NOT NULL DEFAULT 'v2.1.0',
    features JSONB NOT NULL DEFAULT '{}',
    shap_values JSONB,
    top_risk_factors JSONB,
    metadata JSONB NOT NULL DEFAULT '{}',
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_risk_predictions_target ON risk_predictions(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_risk_predictions_tenant ON risk_predictions(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_risk_predictions_expires ON risk_predictions(expires_at) WHERE expires_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_risk_predictions_level ON risk_predictions(risk_level) WHERE risk_level IN ('critical', 'high');
