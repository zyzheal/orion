-- Migration 315: Script Library (Migration 337 in design doc)
-- 脚本库管理：脚本定义、版本管理、参数定义、执行记录

CREATE TABLE script_library (
  id              VARCHAR(64) PRIMARY KEY,
  tenant_id       VARCHAR(64) NOT NULL,
  name            VARCHAR(255) NOT NULL,
  description     TEXT,
  script_type     VARCHAR(32) NOT NULL,
  category        VARCHAR(64),
  tags            JSONB DEFAULT '[]',
  latest_version  INTEGER DEFAULT 1,
  enabled         BOOLEAN NOT NULL DEFAULT true,
  created_by      VARCHAR(64),
  created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE(tenant_id, name)
);

ALTER TABLE script_library ENABLE ROW LEVEL SECURITY;
ALTER TABLE script_library FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON script_library USING (tenant_id = current_setting('app.current_tenant_id', true));

CREATE INDEX idx_script_library_tenant ON script_library(tenant_id);
CREATE INDEX idx_script_library_category ON script_library(category);

-- Script versions
CREATE TABLE script_version (
  id              VARCHAR(64) PRIMARY KEY,
  tenant_id       VARCHAR(64) NOT NULL,
  script_id       VARCHAR(64) NOT NULL REFERENCES script_library(id) ON DELETE CASCADE,
  version         INTEGER NOT NULL,
  content         TEXT NOT NULL,
  changelog       TEXT,
  checksum        VARCHAR(64) NOT NULL,
  created_by      VARCHAR(64),
  created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE(script_id, version)
);

ALTER TABLE script_version ENABLE ROW LEVEL SECURITY;
ALTER TABLE script_version FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON script_version USING (tenant_id = current_setting('app.current_tenant_id', true));

CREATE INDEX idx_script_version_script ON script_version(script_id);

-- Script parameters
CREATE TABLE script_parameter (
  id              VARCHAR(64) PRIMARY KEY,
  tenant_id       VARCHAR(64) NOT NULL,
  script_id       VARCHAR(64) NOT NULL REFERENCES script_library(id) ON DELETE CASCADE,
  param_key       VARCHAR(128) NOT NULL,
  param_type      VARCHAR(32) NOT NULL,
  label           VARCHAR(255) NOT NULL,
  required        BOOLEAN DEFAULT false,
  default_value   TEXT,
  description     TEXT,
  sort_order      INTEGER DEFAULT 0
);

ALTER TABLE script_parameter ENABLE ROW LEVEL SECURITY;
ALTER TABLE script_parameter FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON script_parameter USING (tenant_id = current_setting('app.current_tenant_id', true));

CREATE INDEX idx_script_parameter_script ON script_parameter(script_id);

-- Script executions
CREATE TABLE script_execution (
  id              VARCHAR(64) PRIMARY KEY,
  tenant_id       VARCHAR(64) NOT NULL,
  script_id       VARCHAR(64) NOT NULL REFERENCES script_library(id) ON DELETE CASCADE,
  version         INTEGER NOT NULL,
  status          VARCHAR(32) NOT NULL DEFAULT 'pending',
  targets         JSONB NOT NULL,
  params          JSONB,
  output          TEXT,
  error           TEXT,
  started_at      TIMESTAMP,
  completed_at    TIMESTAMP,
  duration_ms     INTEGER,
  executed_by     VARCHAR(64),
  created_at      TIMESTAMP NOT NULL DEFAULT NOW()
);

ALTER TABLE script_execution ENABLE ROW LEVEL SECURITY;
ALTER TABLE script_execution FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON script_execution USING (tenant_id = current_setting('app.current_tenant_id', true));

CREATE INDEX idx_script_execution_script ON script_execution(script_id);
CREATE INDEX idx_script_execution_status ON script_execution(status);
