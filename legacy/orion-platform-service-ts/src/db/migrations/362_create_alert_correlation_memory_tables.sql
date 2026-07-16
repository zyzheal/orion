-- Migration 362: Persist AlertBuffer and AlertTopologyEdge for AlertCorrelationService
-- Migrates in-memory alertBuffer, topologyEdges, dependencyMap, impactMap to PostgreSQL

-- 1. Alert buffer — stores alerts before they are grouped by correlation engine
CREATE TABLE IF NOT EXISTS alert_buffer (
  id TEXT PRIMARY KEY,
  tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',
  name TEXT NOT NULL,
  severity TEXT NOT NULL,
  source TEXT NOT NULL,
  service TEXT NOT NULL,
  environment TEXT NOT NULL,
  message TEXT NOT NULL DEFAULT '',
  labels JSONB NOT NULL DEFAULT '{}',
  value DOUBLE PRECISION,
  threshold DOUBLE PRECISION,
  fired_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_alert_buffer_tenant ON alert_buffer(tenant_id);
CREATE INDEX IF NOT EXISTS idx_alert_buffer_fired ON alert_buffer(fired_at DESC);
CREATE INDEX IF NOT EXISTS idx_alert_buffer_env ON alert_buffer(environment);

-- 2. Topology edges — stores directed edges for dependency/impact graph
--    dependencyMap: source -> targets (what source depends on)
--    impactMap: target -> sources (what impacts target)
CREATE TABLE IF NOT EXISTS alert_topology_edges (
  id TEXT PRIMARY KEY,
  tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',
  source TEXT NOT NULL,
  target TEXT NOT NULL,
  relation_type TEXT NOT NULL DEFAULT 'depends_on',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_alert_topology_edges_tenant ON alert_topology_edges(tenant_id);
CREATE INDEX IF NOT EXISTS idx_alert_topology_edges_source ON alert_topology_edges(tenant_id, source);
CREATE INDEX IF NOT EXISTS idx_alert_topology_edges_target ON alert_topology_edges(tenant_id, target);
