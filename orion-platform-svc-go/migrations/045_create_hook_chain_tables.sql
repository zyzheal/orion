-- Migration: 001_create_hook_chain_tables.sql
-- Description: Create tables for hook chain (CI/CD lifecycle hooks)
-- Module: hook-chain

CREATE TABLE IF NOT EXISTS hook_chains (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    trigger VARCHAR(255) NOT NULL,
    action VARCHAR(255) NOT NULL,
    config TEXT,
    enabled BOOLEAN NOT NULL DEFAULT true,
    tenant_id UUID NOT NULL,
    user_id UUID NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT fk_hook_chains_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    CONSTRAINT fk_hook_chains_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_hook_chains_tenant_id ON hook_chains(tenant_id);
CREATE INDEX IF NOT EXISTS idx_hook_chains_trigger ON hook_chains(trigger);

CREATE OR REPLACE FUNCTION update_hook_chains_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_hook_chains_updated_at
    BEFORE UPDATE ON hook_chains
    FOR EACH ROW
    EXECUTE FUNCTION update_hook_chains_updated_at();
