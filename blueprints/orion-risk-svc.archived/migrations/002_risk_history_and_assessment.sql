-- Migration 002: Risk History and Enhanced Assessment
-- Adds risk_history table and enhances risk assessment capabilities

-- ==================== Risk History Table ====================

CREATE TABLE IF NOT EXISTS risk_history (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id   UUID REFERENCES risk_assessments(id) ON DELETE SET NULL,
  entity_type     VARCHAR(100) NOT NULL,
  entity_id       VARCHAR(255) NOT NULL,
  risk_level      VARCHAR(20) NOT NULL,
  risk_score      INTEGER NOT NULL DEFAULT 0,
  dimension_scores JSONB NOT NULL DEFAULT '{}',
  factors         JSONB,
  recommendations JSONB,
  changed_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_risk_history_entity ON risk_history(entity_type, entity_id);
CREATE INDEX idx_risk_history_assessment ON risk_history(assessment_id);
CREATE INDEX idx_risk_history_changed ON risk_history(changed_at);

-- ==================== Risk Factors Configuration ====================

-- Table to store configurable risk factor weights
CREATE TABLE IF NOT EXISTS risk_factor_weights (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category        VARCHAR(30) NOT NULL UNIQUE,
  factor_name     VARCHAR(100) NOT NULL,
  weight          DECIMAL(5,2) NOT NULL DEFAULT 1.0,
  description     TEXT,
  is_active       BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Default risk factor weights
INSERT INTO risk_factor_weights (category, factor_name, weight, description) VALUES
-- Security factors
('security', 'vulnerability_count', 2.0, 'Number of known vulnerabilities'),
('security', 'unpatched_cves', 3.0, 'Unpatched CVEs'),
('security', 'access_control_issues', 1.5, 'Access control misconfigurations'),
('security', 'encryption_status', 1.0, 'Data encryption status'),

-- Performance factors
('performance', 'response_time_p95', 1.5, '95th percentile response time'),
('performance', 'error_rate', 2.0, 'Error rate percentage'),
('performance', 'resource_utilization', 1.0, 'CPU/Memory utilization'),
('performance', 'throughput_degradation', 1.5, 'Throughput degradation trend'),

-- Availability factors
('availability', 'uptime_percentage', 2.5, 'Historical uptime percentage'),
('availability', 'incident_count', 2.0, 'Number of incidents in period'),
('availability', 'mtt恢复', 1.5, 'Mean Time To Recovery'),
('availability', 'failover_capability', 1.0, 'Has failover capability'),

-- Compliance factors
('compliance', 'policy_violations', 2.0, 'Policy violation count'),
('compliance', 'audit_findings', 2.5, 'Audit findings'),
('compliance', 'data_retention', 1.0, 'Data retention compliance'),

-- Operational factors
('operational', 'change_failure_rate', 1.5, 'Change failure rate'),
('operational', 'manual_intervention', 1.0, 'Manual intervention frequency'),
('operational', 'documentation_coverage', 0.5, 'Documentation coverage'),

-- Financial factors
('financial', 'cost_overrun', 1.5, 'Cost overrun percentage'),
('financial', 'budget_variance', 1.0, 'Budget variance')
ON CONFLICT (category, factor_name) DO NOTHING;

-- ==================== Comments ====================

COMMENT ON TABLE risk_history IS 'Historical risk score tracking for trend analysis';
COMMENT ON TABLE risk_factor_weights IS 'Configurable risk factor weights for scoring algorithms';

-- ==================== Rollback ====================

-- DROP TABLE IF EXISTS risk_factor_weights, risk_history;