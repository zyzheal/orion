-- Integration Connectors (062)
-- Unified connector system for external integrations (GitLab, Jira, etc.)

-- Integration configurations
CREATE TABLE integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  provider VARCHAR(50) NOT NULL,
  name VARCHAR(100) NOT NULL,
  config JSONB NOT NULL,
  status VARCHAR(20) DEFAULT 'inactive',
  last_sync_at TIMESTAMPTZ,
  sync_status VARCHAR(20),
  error_message TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Integration resource mappings
CREATE TABLE integration_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_id UUID REFERENCES integrations(id) ON DELETE CASCADE,
  resource_type VARCHAR(50),
  resource_id UUID NOT NULL,
  external_id VARCHAR(255),
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Integration sync logs
CREATE TABLE integration_sync_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_id UUID REFERENCES integrations(id) ON DELETE CASCADE,
  sync_type VARCHAR(50),
  status VARCHAR(20),
  records_processed INTEGER DEFAULT 0,
  records_failed INTEGER DEFAULT 0,
  error_message TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);

-- Indexes
CREATE INDEX idx_integrations_tenant ON integrations(tenant_id, provider);
CREATE INDEX idx_integrations_status ON integrations(status);
CREATE INDEX idx_integration_mappings_resource ON integration_mappings(resource_type, resource_id);
CREATE INDEX idx_integration_mappings_external ON integration_mappings(external_id);
CREATE INDEX idx_integration_sync_logs_integration ON integration_sync_logs(integration_id, started_at);

-- Comments
COMMENT ON TABLE integrations IS 'External integration configurations (GitLab, Jira, etc.)';
COMMENT ON TABLE integration_mappings IS 'Mappings between local resources and external system IDs';
COMMENT ON TABLE integration_sync_logs IS 'Sync operation logs for integrations';