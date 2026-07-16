-- 093: Observability Enhancement
-- 自定义告警规则、根因分析、静默规则

CREATE TABLE IF NOT EXISTS custom_alert_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name VARCHAR(200) NOT NULL,
  description TEXT,
  condition_type VARCHAR(30) NOT NULL DEFAULT 'threshold',  -- threshold, trend, composite
  condition_config JSONB NOT NULL DEFAULT '{}',
  severity VARCHAR(20) NOT NULL DEFAULT 'warning',
  notification_channels TEXT[] NOT NULL DEFAULT '{}',
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_by VARCHAR(100) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_custom_alert_rules_tenant ON custom_alert_rules(tenant_id);
CREATE INDEX idx_custom_alert_rules_enabled ON custom_alert_rules(enabled);
CREATE INDEX idx_custom_alert_rules_severity ON custom_alert_rules(severity);
CREATE INDEX idx_custom_alert_rules_created ON custom_alert_rules(created_at DESC);

CREATE TABLE IF NOT EXISTS rca_analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  incident_id VARCHAR(100),
  affected_services TEXT[] NOT NULL DEFAULT '{}',
  root_cause TEXT,
  root_cause_probability FLOAT NOT NULL DEFAULT 0,
  analysis_result JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_rca_analyses_tenant ON rca_analyses(tenant_id);
CREATE INDEX idx_rca_analyses_incident ON rca_analyses(incident_id);
CREATE INDEX idx_rca_analyses_created ON rca_analyses(created_at DESC);

CREATE TABLE IF NOT EXISTS alert_silences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name VARCHAR(200) NOT NULL,
  reason TEXT,
  alert_filter JSONB NOT NULL DEFAULT '{}',
  created_by VARCHAR(100) NOT NULL,
  starts_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ends_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_alert_silences_tenant ON alert_silences(tenant_id);
CREATE INDEX idx_alert_silences_active ON alert_silences(starts_at, ends_at);
CREATE INDEX idx_alert_silences_created ON alert_silences(created_at DESC);

-- ============================================================
-- Row Level Security (RLS) Policies
-- ============================================================

-- custom_alert_rules
ALTER TABLE custom_alert_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE custom_alert_rules FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_custom_alert_rules ON custom_alert_rules
    USING (
        current_setting('app.current_tenant_id', true) IS NOT NULL
        AND current_setting('app.current_tenant_id', true) != ''
        AND tenant_id::text = current_setting('app.current_tenant_id')
    );

CREATE INDEX IF NOT EXISTS idx_custom_alert_rules_tenant_rls ON custom_alert_rules(tenant_id);

COMMENT ON POLICY tenant_isolation_custom_alert_rules ON custom_alert_rules IS
    'Tenant isolation RLS policy - custom alert rules visible only to owning tenant';

-- rca_analyses
ALTER TABLE rca_analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE rca_analyses FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_rca_analyses ON rca_analyses
    USING (
        current_setting('app.current_tenant_id', true) IS NOT NULL
        AND current_setting('app.current_tenant_id', true) != ''
        AND tenant_id::text = current_setting('app.current_tenant_id')
    );

CREATE INDEX IF NOT EXISTS idx_rca_analyses_tenant_rls ON rca_analyses(tenant_id);

COMMENT ON POLICY tenant_isolation_rca_analyses ON rca_analyses IS
    'Tenant isolation RLS policy - RCA analyses visible only to owning tenant';

-- alert_silences
ALTER TABLE alert_silences ENABLE ROW LEVEL SECURITY;
ALTER TABLE alert_silences FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_alert_silences ON alert_silences
    USING (
        current_setting('app.current_tenant_id', true) IS NOT NULL
        AND current_setting('app.current_tenant_id', true) != ''
        AND tenant_id::text = current_setting('app.current_tenant_id')
    );

CREATE INDEX IF NOT EXISTS idx_alert_silences_tenant_rls ON alert_silences(tenant_id);

COMMENT ON POLICY tenant_isolation_alert_silences ON alert_silences IS
    'Tenant isolation RLS policy - alert silences visible only to owning tenant';
