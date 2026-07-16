-- Migration 316: Compliance Report (Migration 335 in design doc)
-- 合规管理：合规规则、检查执行、检查结果、报告、定时调度

CREATE TABLE compliance_rule (
  id              VARCHAR(64) PRIMARY KEY,
  tenant_id       VARCHAR(64) NOT NULL,
  name            VARCHAR(255) NOT NULL,
  description     TEXT,
  framework       VARCHAR(64) NOT NULL,
  category        VARCHAR(64) NOT NULL,
  rule_type       VARCHAR(32) NOT NULL,
  check_config    JSONB NOT NULL,
  severity        VARCHAR(16) NOT NULL DEFAULT 'medium',
  enabled         BOOLEAN NOT NULL DEFAULT true,
  created_by      VARCHAR(64),
  created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMP NOT NULL DEFAULT NOW()
);

ALTER TABLE compliance_rule ENABLE ROW LEVEL SECURITY;
ALTER TABLE compliance_rule FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON compliance_rule USING (tenant_id = current_setting('app.current_tenant_id', true));

CREATE INDEX idx_compliance_rule_framework ON compliance_rule(framework);
CREATE INDEX idx_compliance_rule_category ON compliance_rule(category);

-- Compliance checks
CREATE TABLE compliance_check (
  id              VARCHAR(64) PRIMARY KEY,
  tenant_id       VARCHAR(64) NOT NULL,
  check_type      VARCHAR(32) NOT NULL,
  status          VARCHAR(32) NOT NULL DEFAULT 'running',
  total_rules     INTEGER NOT NULL,
  passed_rules    INTEGER DEFAULT 0,
  failed_rules    INTEGER DEFAULT 0,
  score           DECIMAL(5,2),
  started_at      TIMESTAMP NOT NULL DEFAULT NOW(),
  completed_at    TIMESTAMP,
  triggered_by    VARCHAR(64)
);

ALTER TABLE compliance_check ENABLE ROW LEVEL SECURITY;
ALTER TABLE compliance_check FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON compliance_check USING (tenant_id = current_setting('app.current_tenant_id', true));

CREATE INDEX idx_compliance_check_tenant ON compliance_check(tenant_id);

-- Compliance check results
CREATE TABLE compliance_check_result (
  id              VARCHAR(64) PRIMARY KEY,
  tenant_id       VARCHAR(64) NOT NULL,
  check_id        VARCHAR(64) NOT NULL REFERENCES compliance_check(id) ON DELETE CASCADE,
  rule_id         VARCHAR(64) NOT NULL REFERENCES compliance_rule(id),
  passed          BOOLEAN NOT NULL,
  details         JSONB,
  remediation     TEXT,
  checked_at      TIMESTAMP NOT NULL DEFAULT NOW()
);

ALTER TABLE compliance_check_result ENABLE ROW LEVEL SECURITY;
ALTER TABLE compliance_check_result FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON compliance_check_result USING (tenant_id = current_setting('app.current_tenant_id', true));

CREATE INDEX idx_compliance_check_result_check ON compliance_check_result(check_id);

-- Compliance reports
CREATE TABLE compliance_report (
  id              VARCHAR(64) PRIMARY KEY,
  tenant_id       VARCHAR(64) NOT NULL,
  name            VARCHAR(255) NOT NULL,
  description     TEXT,
  report_type     VARCHAR(32) NOT NULL,
  period          VARCHAR(32) NOT NULL,
  rule_ids        JSONB,
  status          VARCHAR(32) NOT NULL DEFAULT 'pending',
  generated_at    TIMESTAMP,
  data            JSONB,
  created_by      VARCHAR(64),
  created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMP NOT NULL DEFAULT NOW()
);

ALTER TABLE compliance_report ENABLE ROW LEVEL SECURITY;
ALTER TABLE compliance_report FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON compliance_report USING (tenant_id = current_setting('app.current_tenant_id', true));

CREATE INDEX idx_compliance_report_tenant ON compliance_report(tenant_id);

-- Compliance schedules
CREATE TABLE compliance_schedule (
  id              VARCHAR(64) PRIMARY KEY,
  tenant_id       VARCHAR(64) NOT NULL,
  name            VARCHAR(255) NOT NULL,
  rule_ids        JSONB NOT NULL,
  cron_expression VARCHAR(64) NOT NULL,
  enabled         BOOLEAN NOT NULL DEFAULT true,
  last_run_at     TIMESTAMP,
  next_run_at     TIMESTAMP,
  created_by      VARCHAR(64),
  created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMP NOT NULL DEFAULT NOW()
);

ALTER TABLE compliance_schedule ENABLE ROW LEVEL SECURITY;
ALTER TABLE compliance_schedule FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON compliance_schedule USING (tenant_id = current_setting('app.current_tenant_id', true));

CREATE INDEX idx_compliance_schedule_tenant ON compliance_schedule(tenant_id);
