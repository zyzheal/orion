-- Deploy Windows and Emergency Deployments
-- Provides maintenance windows, blackout periods, and emergency deployment channels

-- Deploy Windows table
CREATE TABLE IF NOT EXISTS deploy_windows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    name VARCHAR(200) NOT NULL,
    type VARCHAR(20) NOT NULL CHECK (type IN ('maintenance', 'blackout')),
    schedule VARCHAR(100) NOT NULL, -- 5-field cron expression
    duration_minutes INT NOT NULL CHECK (duration_minutes > 0 AND duration_minutes <= 10080),
    environments TEXT[] NOT NULL DEFAULT '{}', -- array of env IDs, '*' means all
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for tenant lookups
CREATE INDEX IF NOT EXISTS idx_deploy_windows_tenant ON deploy_windows (tenant_id);

-- Index for type filtering
CREATE INDEX IF NOT EXISTS idx_deploy_windows_type ON deploy_windows (type);

-- Emergency Deployments table
CREATE TABLE IF NOT EXISTS deploy_emergencies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    deployment_id UUID NOT NULL,
    reason TEXT NOT NULL,
    requested_by UUID NOT NULL,
    approved_by UUID,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    audit_log JSONB DEFAULT '[]',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for tenant lookups
CREATE INDEX IF NOT EXISTS idx_deploy_emergencies_tenant ON deploy_emergencies (tenant_id);

-- Index for status filtering
CREATE INDEX IF NOT EXISTS idx_deploy_emergencies_status ON deploy_emergencies (status);

-- RLS policies
ALTER TABLE deploy_windows ENABLE ROW LEVEL SECURITY;
ALTER TABLE deploy_emergencies ENABLE ROW LEVEL SECURITY;

-- Windows: users can only see/manage windows for their tenant
CREATE POLICY tenant_isolation_windows ON deploy_windows
    USING (tenant_id IN (SELECT tenant_id FROM tenants WHERE id = tenant_id));

-- Emergencies: users can only see/manage emergencies for their tenant
CREATE POLICY tenant_isolation_emergencies ON deploy_emergencies
    USING (tenant_id IN (SELECT tenant_id FROM tenants WHERE id = tenant_id));

-- Updated at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_deploy_windows_updated_at
    BEFORE UPDATE ON deploy_windows
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_deploy_emergencies_updated_at
    BEFORE UPDATE ON deploy_emergencies
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
