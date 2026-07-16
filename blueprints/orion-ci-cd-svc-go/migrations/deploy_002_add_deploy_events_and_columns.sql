-- Add missing columns to deployments table for full business logic support
ALTER TABLE deployments ADD COLUMN IF NOT EXISTS started_at TIMESTAMP;
ALTER TABLE deployments ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP;
ALTER TABLE deployments ADD COLUMN IF NOT EXISTS duration_ms BIGINT;
ALTER TABLE deployments ADD COLUMN IF NOT EXISTS error_message TEXT;
ALTER TABLE deployments ADD COLUMN IF NOT EXISTS strategy VARCHAR(50) DEFAULT 'rolling';

-- Create deployment_events table for audit logging
CREATE TABLE IF NOT EXISTS deployment_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    deployment_id UUID NOT NULL REFERENCES deployments(id) ON DELETE CASCADE,
    event_type VARCHAR(50) NOT NULL,
    message TEXT,
    actor_id VARCHAR(255),
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_deployment_events_deployment_id ON deployment_events (deployment_id);
CREATE INDEX IF NOT EXISTS idx_deployments_tenant_env ON deployments (tenant_id, environment);
CREATE INDEX IF NOT EXISTS idx_deployments_status ON deployments (status);
