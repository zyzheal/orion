-- Migration 312: SLA Management (ITSM Phase B)
-- Creates tables for SLA definitions, tracking, and breach events.

-- SLA Definitions
CREATE TABLE IF NOT EXISTS sla_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id VARCHAR(64) NOT NULL,  -- 应用层通过 getCurrentTenantId() 设置
  name VARCHAR(255) NOT NULL,
  description TEXT,
  type VARCHAR(50) NOT NULL DEFAULT 'response', -- response, resolution, availability
  target_value NUMERIC NOT NULL, -- e.g., 99.9 for availability, 30 for minutes
  target_unit VARCHAR(20) NOT NULL DEFAULT 'minutes', -- minutes, hours, percent
  business_hours_only BOOLEAN DEFAULT false,
  priority VARCHAR(20), -- critical, high, medium, low (null = applies to all)
  category VARCHAR(100),
  escalation_rules JSONB,
  metadata JSONB,
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  created_by VARCHAR(128),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- SLA Tracking (linked to incidents/requests)
CREATE TABLE IF NOT EXISTS sla_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id VARCHAR(64) NOT NULL,  -- 应用层通过 getCurrentTenantId() 设置
  sla_definition_id UUID NOT NULL REFERENCES sla_definitions(id) ON DELETE CASCADE,
  entity_type VARCHAR(50) NOT NULL, -- incident, request, change
  entity_id UUID NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'tracking', -- tracking, met, breached, paused
  start_time TIMESTAMP NOT NULL DEFAULT NOW(),
  target_time TIMESTAMP NOT NULL,
  actual_time TIMESTAMP,
  breach_time TIMESTAMP,
  pause_duration INTERVAL DEFAULT '0',
  notes TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- SLA Breach Events
CREATE TABLE IF NOT EXISTS sla_breach_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id VARCHAR(64) NOT NULL,  -- 应用层通过 getCurrentTenantId() 设置
  sla_tracking_id UUID NOT NULL REFERENCES sla_tracking(id) ON DELETE CASCADE,
  event_type VARCHAR(30) NOT NULL, -- warning, breach, escalation
  event_time TIMESTAMP NOT NULL DEFAULT NOW(),
  details JSONB,
  notified_users TEXT[],
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_sla_definitions_tenant ON sla_definitions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_sla_definitions_status ON sla_definitions(status);
CREATE INDEX IF NOT EXISTS idx_sla_tracking_tenant ON sla_tracking(tenant_id);
CREATE INDEX IF NOT EXISTS idx_sla_tracking_entity ON sla_tracking(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_sla_tracking_status ON sla_tracking(status);
CREATE INDEX IF NOT EXISTS idx_sla_breach_events_tracking ON sla_breach_events(sla_tracking_id);

-- RLS 多租户隔离
ALTER TABLE sla_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE sla_definitions FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON sla_definitions USING (tenant_id = current_setting('app.current_tenant_id', true));

ALTER TABLE sla_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE sla_tracking FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON sla_tracking USING (tenant_id = current_setting('app.current_tenant_id', true));

ALTER TABLE sla_breach_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE sla_breach_events FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON sla_breach_events USING (tenant_id = current_setting('app.current_tenant_id', true));
