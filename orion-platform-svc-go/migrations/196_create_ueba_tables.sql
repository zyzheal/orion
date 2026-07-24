-- Ueba module tables (auto-generated)

CREATE TABLE IF NOT EXISTS u_e_b_a_alerts (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    user_id VARCHAR(255) NOT NULL,
    entity_type VARCHAR(255) NOT NULL,
    entity_id VARCHAR(255) NOT NULL,
    event_type VARCHAR(255) NOT NULL,
    severity VARCHAR(255) NOT NULL,
    score DOUBLE PRECISION NOT NULL,
    anomaly_type VARCHAR(255) NOT NULL,
    description VARCHAR(255),
    evidence VARCHAR(255) NOT NULL,
    status VARCHAR(255) NOT NULL,
    reviewed_at TIMESTAMP WITH TIME ZONE,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE,
);

CREATE INDEX IF NOT EXISTS idx_u_e_b_a_alerts_tenant ON u_e_b_a_alerts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_u_e_b_a_alerts_created ON u_e_b_a_alerts(created_at DESC);

CREATE TABLE IF NOT EXISTS u_e_b_a_profiles (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    user_id VARCHAR(255) NOT NULL,
    entity_type VARCHAR(255) NOT NULL,
    entity_id VARCHAR(255) NOT NULL,
    profile_data VARCHAR(255) NOT NULL,
    last_update_at TIMESTAMP WITH TIME ZONE NOT NULL,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE,
);

CREATE INDEX IF NOT EXISTS idx_u_e_b_a_profiles_tenant ON u_e_b_a_profiles(tenant_id);
CREATE INDEX IF NOT EXISTS idx_u_e_b_a_profiles_created ON u_e_b_a_profiles(created_at DESC);

