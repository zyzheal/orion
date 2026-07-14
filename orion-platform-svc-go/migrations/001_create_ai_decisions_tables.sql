-- AI Decisions Tables
-- Migration for orion-platform-svc-go

CREATE TABLE IF NOT EXISTS ai_decisions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(255) NOT NULL,
    type VARCHAR(100) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    input JSONB NOT NULL,
    output JSONB NOT NULL,
    confidence NUMERIC(5,4) NOT NULL,
    model_id VARCHAR(255),
    model_version VARCHAR(100),
    reasoning JSONB DEFAULT '{}',
    context JSONB DEFAULT '{}',
    impact JSONB,
    created_by VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    executed_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS ai_decision_feedback (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(255) NOT NULL,
    decision_id UUID NOT NULL REFERENCES ai_decisions(id),
    type VARCHAR(50) NOT NULL DEFAULT 'neutral',
    comment TEXT,
    outcome TEXT,
    actual_impact JSONB,
    created_by VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ai_decision_traces (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(255) NOT NULL,
    decision_id UUID NOT NULL REFERENCES ai_decisions(id),
    step INT NOT NULL,
    action VARCHAR(255) NOT NULL,
    description TEXT,
    input JSONB DEFAULT '{}',
    output JSONB DEFAULT '{}',
    duration INT NOT NULL DEFAULT 0,
    timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_ai_decisions_tenant_id ON ai_decisions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ai_decisions_type ON ai_decisions(type);
CREATE INDEX IF NOT EXISTS idx_ai_decisions_status ON ai_decisions(status);
CREATE INDEX IF NOT EXISTS idx_ai_decisions_model_id ON ai_decisions(model_id);
CREATE INDEX IF NOT EXISTS idx_ai_decisions_created_at ON ai_decisions(created_at);
CREATE INDEX IF NOT EXISTS idx_ai_decision_feedback_decision_id ON ai_decision_feedback(decision_id);
CREATE INDEX IF NOT EXISTS idx_ai_decision_feedback_tenant_id ON ai_decision_feedback(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ai_decision_traces_decision_id ON ai_decision_traces(decision_id);
CREATE INDEX IF NOT EXISTS idx_ai_decision_traces_tenant_id ON ai_decision_traces(tenant_id);
