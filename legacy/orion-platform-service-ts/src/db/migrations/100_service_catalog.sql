-- Migration 100: Create service catalog tables (ITIL)
-- Stores catalog service definitions and service requests

-- Service catalog entries
CREATE TABLE IF NOT EXISTS catalog_services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  category VARCHAR(100) NOT NULL DEFAULT 'general',
  icon VARCHAR(50),
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  owner_id VARCHAR(255),
  team_id VARCHAR(255),
  sla_hours INTEGER,
  form_schema JSONB DEFAULT '{}',
  approval_required BOOLEAN DEFAULT false,
  approval_flow JSONB DEFAULT '[]',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_catalog_service_status CHECK (status IN ('active', 'deprecated', 'retired'))
);

CREATE INDEX IF NOT EXISTS idx_catalog_services_tenant ON catalog_services(tenant_id);
CREATE INDEX IF NOT EXISTS idx_catalog_services_category ON catalog_services(tenant_id, category);
CREATE INDEX IF NOT EXISTS idx_catalog_services_status ON catalog_services(tenant_id, status);

-- Service requests
CREATE TABLE IF NOT EXISTS catalog_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  service_id UUID NOT NULL REFERENCES catalog_services(id),
  requester_id VARCHAR(255) NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'pending',
  form_data JSONB DEFAULT '{}',
  priority VARCHAR(20) DEFAULT 'medium',
  assigned_to VARCHAR(255),
  approval_status VARCHAR(20),
  approved_by VARCHAR(255),
  approved_at TIMESTAMPTZ,
  fulfilled_at TIMESTAMPTZ,
  notes TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_catalog_request_status CHECK (status IN ('pending', 'approved', 'in_progress', 'fulfilled', 'rejected', 'cancelled')),
  CONSTRAINT chk_catalog_request_priority CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  CONSTRAINT chk_catalog_approval_status CHECK (approval_status IS NULL OR approval_status IN ('pending', 'approved', 'rejected'))
);

CREATE INDEX IF NOT EXISTS idx_catalog_requests_tenant ON catalog_requests(tenant_id);
CREATE INDEX IF NOT EXISTS idx_catalog_requests_service ON catalog_requests(service_id);
CREATE INDEX IF NOT EXISTS idx_catalog_requests_status ON catalog_requests(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_catalog_requests_requester ON catalog_requests(tenant_id, requester_id);
