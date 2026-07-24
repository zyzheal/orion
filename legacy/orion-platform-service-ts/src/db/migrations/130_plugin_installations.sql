-- Migration 130: Plugin Installations
-- 记录 Marketplace 和 Remote 插件安装状态

CREATE TABLE IF NOT EXISTS plugin_installations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plugin_id VARCHAR(255) NOT NULL,
    tenant_id UUID NOT NULL,
    source VARCHAR(50) NOT NULL,  -- 'marketplace', 'remote'
    version VARCHAR(50) NOT NULL,
    trust_level VARCHAR(20) NOT NULL,     -- 'HIGH', 'MEDIUM', 'LOW', 'UNTRUSTED'
    isolation_tier VARCHAR(20) NOT NULL,  -- 'TIER_1', 'TIER_2', 'TIER_3', 'TIER_4'
    status VARCHAR(20) NOT NULL DEFAULT 'installed',  -- 'installed', 'active', 'disabled', 'uninstalling'
    config JSONB,                          -- 安装时的配置快照
    installed_by VARCHAR(255) NOT NULL,
    installed_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS plugin_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plugin_id VARCHAR(255) NOT NULL,
    version VARCHAR(50) NOT NULL,
    tenant_id UUID,  -- NULL for marketplace versions
    manifest JSONB NOT NULL,              -- Full plugin manifest
    download_url VARCHAR(500),
    checksum VARCHAR(64),                 -- SHA-256
    is_active BOOLEAN NOT NULL DEFAULT false,
    published_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_installation_tenant ON plugin_installations(tenant_id);
CREATE INDEX idx_installation_plugin ON plugin_installations(plugin_id);
CREATE INDEX idx_installation_status ON plugin_installations(status);
CREATE INDEX idx_version_plugin ON plugin_versions(plugin_id);
CREATE INDEX idx_version_plugin_version ON plugin_versions(plugin_id, version);

COMMENT ON TABLE plugin_installations IS 'Tenant plugin installation tracking';
COMMENT ON TABLE plugin_versions IS 'Plugin version metadata for marketplace and installed plugins';

-- Enable RLS
ALTER TABLE plugin_installations ENABLE ROW LEVEL SECURITY;
ALTER TABLE plugin_installations FORCE ROW LEVEL SECURITY;
CREATE POLICY installations_tenant_isolation ON plugin_installations
    USING (app.current_tenant_id IS NOT NULL AND app.current_tenant_id::uuid = tenant_id);

ALTER TABLE plugin_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE plugin_versions FORCE ROW LEVEL SECURITY;
CREATE POLICY versions_tenant_isolation ON plugin_versions
    USING (tenant_id IS NULL OR (app.current_tenant_id IS NOT NULL AND app.current_tenant_id::uuid = tenant_id));
