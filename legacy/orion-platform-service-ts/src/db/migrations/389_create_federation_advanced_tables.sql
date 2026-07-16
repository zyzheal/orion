-- Migration: 389_create_federation_advanced_tables.sql
-- Purpose: Persist federation advanced features (scheduling policies, cross-cluster jobs, resource pools)

CREATE TABLE IF NOT EXISTS federation_scheduling_policies (
  id VARCHAR(200) PRIMARY KEY,
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  name VARCHAR(200) NOT NULL,
  description TEXT,
  strategy VARCHAR(50) NOT NULL DEFAULT 'balanced',
  rules JSONB DEFAULT '{}',
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS federation_cross_cluster_jobs (
  id VARCHAR(200) PRIMARY KEY,
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  name VARCHAR(200) NOT NULL,
  spec JSONB DEFAULT '{}',
  target_clusters TEXT[] DEFAULT '{}',
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  scheduled_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS federation_resource_pools (
  id VARCHAR(200) PRIMARY KEY,
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  name VARCHAR(200) NOT NULL,
  description TEXT,
  cluster_id VARCHAR(200) NOT NULL,
  cpu NUMERIC(10,2) NOT NULL DEFAULT 0,
  memory NUMERIC(10,2) NOT NULL DEFAULT 0,
  used_cpu NUMERIC(10,2) NOT NULL DEFAULT 0,
  used_memory NUMERIC(10,2) NOT NULL DEFAULT 0,
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_federation_scheduling_tenant ON federation_scheduling_policies(tenant_id);
CREATE INDEX idx_federation_jobs_tenant ON federation_cross_cluster_jobs(tenant_id);
CREATE INDEX idx_federation_pools_tenant ON federation_resource_pools(tenant_id);
CREATE INDEX idx_federation_pools_cluster ON federation_resource_pools(cluster_id);
