-- Migration 028: AI Change Intelligence
-- Creates tables for change intelligence reports, affected services, risk factors, and historical matches

-- 变更智能报告
CREATE TABLE IF NOT EXISTS change_intelligence_reports (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pr_id           VARCHAR(100) NOT NULL,
  repo_id         VARCHAR(100) NOT NULL,
  commit_sha      VARCHAR(40) NOT NULL,
  risk_score      DECIMAL(3,2) NOT NULL,               -- 0.00 - 1.00
  risk_level      VARCHAR(20) NOT NULL,                 -- low | medium | high | critical
  affected_services INT NOT NULL DEFAULT 0,
  affected_capabilities INT NOT NULL DEFAULT 0,
  shap_factors    JSONB,                                -- [{factor, value, contribution}]
  gitlab_comment_posted BOOLEAN DEFAULT false,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_ci_reports_pr ON change_intelligence_reports(pr_id, repo_id);
CREATE INDEX idx_ci_reports_risk ON change_intelligence_reports(risk_level);

-- 受影响服务
CREATE TABLE IF NOT EXISTS change_intelligence_affected_services (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id       UUID REFERENCES change_intelligence_reports(id) ON DELETE CASCADE,
  service_name    VARCHAR(100) NOT NULL,
  service_tier    VARCHAR(10),                          -- tier-0 | tier-1 | tier-2
  impact_type     VARCHAR(50),                          -- direct | dependency | indirect
  changed_files   JSONB,                                -- [file_paths affecting this service]
  slo_risk        VARCHAR(20),                          -- none | low | medium | high
  recommended_reviewers JSONB                           -- [user_ids]
);
CREATE INDEX idx_ci_affected_services_report ON change_intelligence_affected_services(report_id);
CREATE INDEX idx_ci_affected_services_name ON change_intelligence_affected_services(service_name);

-- 风险因子
CREATE TABLE IF NOT EXISTS change_intelligence_risk_factors (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id       UUID REFERENCES change_intelligence_reports(id) ON DELETE CASCADE,
  factor_name     VARCHAR(50) NOT NULL,
  factor_value    DECIMAL(5,3) NOT NULL,
  weight          DECIMAL(3,2) NOT NULL,
  contribution    DECIMAL(5,3) NOT NULL,                -- SHAP value
  description     TEXT
);
CREATE INDEX idx_ci_risk_factors_report ON change_intelligence_risk_factors(report_id);

-- 历史匹配
CREATE TABLE IF NOT EXISTS change_intelligence_historical_matches (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id       UUID REFERENCES change_intelligence_reports(id) ON DELETE CASCADE,
  historical_pr   VARCHAR(100),
  similarity      DECIMAL(3,2),
  incident_linked BOOLEAN DEFAULT false,
  incident_id     VARCHAR(100)
);
CREATE INDEX idx_ci_historical_matches_report ON change_intelligence_historical_matches(report_id);
CREATE INDEX idx_ci_historical_matches_incident ON change_intelligence_historical_matches(incident_id) WHERE incident_linked = true;
