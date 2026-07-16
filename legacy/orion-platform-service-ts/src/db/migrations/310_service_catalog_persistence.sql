-- Migration 310: Service Catalog Persistence
-- ITSM module for managing service offerings and service requests

-- ==================== catalog_services ====================
CREATE TABLE IF NOT EXISTS catalog_services (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id            UUID NOT NULL,
  name                 VARCHAR(255) NOT NULL,
  description          TEXT,
  category             VARCHAR(100) NOT NULL DEFAULT 'general',
  status               VARCHAR(20) NOT NULL DEFAULT 'active'
                         CHECK (status IN ('active', 'inactive', 'retired')),
  owner                VARCHAR(255),
  support_team         VARCHAR(255),
  sla_tier             VARCHAR(20) DEFAULT 'bronze'
                         CHECK (sla_tier IN ('gold', 'silver', 'bronze')),
  availability_target  DECIMAL(5,2),
  response_time_target INT,
  related_systems      TEXT[] DEFAULT '{}',
  metadata             JSONB DEFAULT '{}',
  created_by           VARCHAR(255),
  created_at           TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ==================== catalog_requests ====================
CREATE TABLE IF NOT EXISTS catalog_requests (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id            UUID NOT NULL,
  service_id           UUID NOT NULL REFERENCES catalog_services(id) ON DELETE CASCADE,
  requester_id         VARCHAR(255) NOT NULL,
  title                VARCHAR(500) NOT NULL,
  description          TEXT,
  priority             VARCHAR(20) NOT NULL DEFAULT 'medium'
                         CHECK (priority IN ('critical', 'high', 'medium', 'low')),
  status               VARCHAR(30) NOT NULL DEFAULT 'pending'
                         CHECK (status IN ('pending', 'approved', 'in_progress', 'fulfilled', 'rejected', 'cancelled')),
  assigned_to          VARCHAR(255),
  approved_by          VARCHAR(255),
  approved_at          TIMESTAMP,
  fulfilled_at         TIMESTAMP,
  sla_breach           BOOLEAN DEFAULT false,
  created_at           TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ==================== catalog_request_timeline ====================
CREATE TABLE IF NOT EXISTS catalog_request_timeline (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id           UUID NOT NULL REFERENCES catalog_requests(id) ON DELETE CASCADE,
  tenant_id            UUID NOT NULL,
  event_type           VARCHAR(50) NOT NULL,
  description          TEXT,
  created_by           VARCHAR(255),
  created_at           TIMESTAMP NOT NULL DEFAULT NOW(),
  metadata             JSONB DEFAULT '{}'
);

-- ==================== Indexes ====================

-- catalog_services indexes
CREATE INDEX IF NOT EXISTS idx_catalog_services_tenant_id ON catalog_services(tenant_id);
CREATE INDEX IF NOT EXISTS idx_catalog_services_status ON catalog_services(status);
CREATE INDEX IF NOT EXISTS idx_catalog_services_category ON catalog_services(category);
CREATE INDEX IF NOT EXISTS idx_catalog_services_owner ON catalog_services(owner);
CREATE INDEX IF NOT EXISTS idx_catalog_services_sla_tier ON catalog_services(sla_tier);

-- catalog_requests indexes
CREATE INDEX IF NOT EXISTS idx_catalog_requests_tenant_id ON catalog_requests(tenant_id);
CREATE INDEX IF NOT EXISTS idx_catalog_requests_service_id ON catalog_requests(service_id);
CREATE INDEX IF NOT EXISTS idx_catalog_requests_requester_id ON catalog_requests(requester_id);
CREATE INDEX IF NOT EXISTS idx_catalog_requests_status ON catalog_requests(status);
CREATE INDEX IF NOT EXISTS idx_catalog_requests_priority ON catalog_requests(priority);
CREATE INDEX IF NOT EXISTS idx_catalog_requests_assigned_to ON catalog_requests(assigned_to);
CREATE INDEX IF NOT EXISTS idx_catalog_requests_sla_breach ON catalog_requests(sla_breach) WHERE sla_breach = true;

-- catalog_request_timeline indexes
CREATE INDEX IF NOT EXISTS idx_catalog_request_timeline_request_id ON catalog_request_timeline(request_id);
CREATE INDEX IF NOT EXISTS idx_catalog_request_timeline_tenant_id ON catalog_request_timeline(tenant_id);
CREATE INDEX IF NOT EXISTS idx_catalog_request_timeline_event_type ON catalog_request_timeline(event_type);
