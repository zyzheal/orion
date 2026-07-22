-- ChatOps SSE Connections persistence
-- Migrates SSEConnectionManager from Map() to PostgreSQL

CREATE TABLE IF NOT EXISTS chatops_sse_connections (
  id VARCHAR(64) PRIMARY KEY,
  tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',
  user_id VARCHAR(64) NOT NULL,
  connected_at TIMESTAMP NOT NULL DEFAULT NOW(),
  last_heartbeat_at TIMESTAMP NOT NULL DEFAULT NOW(),
  status VARCHAR(32) NOT NULL DEFAULT 'active'
);

CREATE INDEX IF NOT EXISTS idx_chatops_sse_connections_user_id ON chatops_sse_connections(user_id);
CREATE INDEX IF NOT EXISTS idx_chatops_sse_connections_status ON chatops_sse_connections(status);
CREATE INDEX IF NOT EXISTS idx_chatops_sse_connections_tenant_id ON chatops_sse_connections(tenant_id);
