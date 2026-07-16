-- Migration 318: Report Designer (Migration 334 in design doc)
-- 报表设计器：报表定义、数据源、调度、导出历史

CREATE TABLE report_definition (
  id              VARCHAR(64) PRIMARY KEY,
  tenant_id       VARCHAR(64) NOT NULL,
  name            VARCHAR(255) NOT NULL,
  description     TEXT,
  category        VARCHAR(64),
  layout          JSONB NOT NULL,
  components      JSONB NOT NULL,
  datasource_bindings JSONB,
  template_id     VARCHAR(64),
  enabled         BOOLEAN NOT NULL DEFAULT true,
  created_by      VARCHAR(64),
  created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMP NOT NULL DEFAULT NOW()
);

ALTER TABLE report_definition ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_definition FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON report_definition USING (tenant_id = current_setting('app.current_tenant_id', true));

CREATE INDEX idx_report_definition_tenant ON report_definition(tenant_id);
CREATE INDEX idx_report_definition_category ON report_definition(category);

-- Report datasources
CREATE TABLE report_datasource (
  id              VARCHAR(64) PRIMARY KEY,
  tenant_id       VARCHAR(64) NOT NULL,
  name            VARCHAR(255) NOT NULL,
  datasource_type VARCHAR(32) NOT NULL,
  config          JSONB NOT NULL,
  refresh_interval INTEGER,
  created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMP NOT NULL DEFAULT NOW()
);

ALTER TABLE report_datasource ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_datasource FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON report_datasource USING (tenant_id = current_setting('app.current_tenant_id', true));

CREATE INDEX idx_report_datasource_tenant ON report_datasource(tenant_id);

-- Report schedules
CREATE TABLE report_schedule (
  id              VARCHAR(64) PRIMARY KEY,
  tenant_id       VARCHAR(64) NOT NULL,
  report_id       VARCHAR(64) NOT NULL REFERENCES report_definition(id) ON DELETE CASCADE,
  cron_expression VARCHAR(64) NOT NULL,
  export_format   VARCHAR(16) NOT NULL,
  recipients      JSONB,
  enabled         BOOLEAN NOT NULL DEFAULT true,
  last_run_at     TIMESTAMP,
  next_run_at     TIMESTAMP,
  created_at      TIMESTAMP NOT NULL DEFAULT NOW()
);

ALTER TABLE report_schedule ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_schedule FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON report_schedule USING (tenant_id = current_setting('app.current_tenant_id', true));

CREATE INDEX idx_report_schedule_report ON report_schedule(report_id);

-- Report execution history
CREATE TABLE report_execution_history (
  id              VARCHAR(64) PRIMARY KEY,
  tenant_id       VARCHAR(64) NOT NULL,
  report_id       VARCHAR(64) NOT NULL REFERENCES report_definition(id) ON DELETE CASCADE,
  schedule_id     VARCHAR(64),
  export_format   VARCHAR(16) NOT NULL,
  status          VARCHAR(32) NOT NULL DEFAULT 'pending',
  file_url        VARCHAR(512),
  error           TEXT,
  started_at      TIMESTAMP,
  completed_at    TIMESTAMP,
  duration_ms     INTEGER,
  triggered_by    VARCHAR(64),
  created_at      TIMESTAMP NOT NULL DEFAULT NOW()
);

ALTER TABLE report_execution_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_execution_history FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON report_execution_history USING (tenant_id = current_setting('app.current_tenant_id', true));

CREATE INDEX idx_report_execution_history_report ON report_execution_history(report_id);
CREATE INDEX idx_report_execution_history_status ON report_execution_history(status);
