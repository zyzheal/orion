-- Migration 061: Process Step Engine (Migration 340)
-- Step-driven workflow engine: definitions, instances, step instances (12 states)

CREATE TABLE IF NOT EXISTS process_definitions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       VARCHAR(64) NOT NULL,
  name            VARCHAR(255) NOT NULL,
  description     TEXT,
  version         INTEGER NOT NULL DEFAULT 1,
  entity_type     VARCHAR(32) NOT NULL,           -- 'ticket' | 'change' | 'custom'
  enabled         BOOLEAN NOT NULL DEFAULT true,
  steps           JSONB NOT NULL DEFAULT '[]',     -- step definition array
  transitions     JSONB NOT NULL DEFAULT '[]',     -- state transition rules
  created_by      VARCHAR(64),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, name, version)
);

-- RLS multi-tenant isolation
ALTER TABLE process_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE process_definitions FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON process_definitions USING (tenant_id = current_setting('app.current_tenant_id', true));

CREATE INDEX idx_process_def_tenant ON process_definitions(tenant_id);
CREATE INDEX idx_process_def_entity ON process_definitions(entity_type);
CREATE INDEX idx_process_def_enabled ON process_definitions(enabled) WHERE enabled = true;

-- Process instances
CREATE TABLE IF NOT EXISTS process_instances (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           VARCHAR(64) NOT NULL,
  definition_id       UUID NOT NULL REFERENCES process_definitions(id),
  definition_snapshot JSONB NOT NULL,               -- snapshot at start time
  entity_type         VARCHAR(32) NOT NULL,
  entity_id           VARCHAR(64) NOT NULL,
  current_step_id     VARCHAR(64),
  status              VARCHAR(32) NOT NULL DEFAULT 'running',  -- running|paused|completed|aborted
  started_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at        TIMESTAMPTZ,
  created_by          VARCHAR(64),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS multi-tenant isolation
ALTER TABLE process_instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE process_instances FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON process_instances USING (tenant_id = current_setting('app.current_tenant_id', true));

CREATE INDEX idx_process_inst_tenant ON process_instances(tenant_id);
CREATE INDEX idx_process_inst_entity ON process_instances(entity_type, entity_id);
CREATE INDEX idx_process_inst_status ON process_instances(status);
CREATE INDEX idx_process_inst_def ON process_instances(definition_id);

-- Process step instances (12 states: draft, pending, running, success, failed, paused, aborted, wait, retry, rejected, skip, close)
CREATE TABLE IF NOT EXISTS process_step_instances (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       VARCHAR(64) NOT NULL,
  instance_id     UUID NOT NULL REFERENCES process_instances(id) ON DELETE CASCADE,
  step_id         VARCHAR(64) NOT NULL,            -- matches definition step ID
  step_name       VARCHAR(255) NOT NULL,
  step_type       VARCHAR(32) NOT NULL,            -- 'auto' | 'manual' | 'approval' | 'condition'
  handler_key     VARCHAR(128),                    -- HandlerRegistry SPI key
  status          VARCHAR(32) NOT NULL DEFAULT 'pending',  -- 12 states
  input_data      JSONB,
  output_data     JSONB,
  started_at      TIMESTAMPTZ,
  completed_at    TIMESTAMPTZ,
  operator        VARCHAR(64),                     -- operator user ID
  comment         TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS multi-tenant isolation
ALTER TABLE process_step_instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE process_step_instances FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON process_step_instances USING (tenant_id = current_setting('app.current_tenant_id', true));

CREATE INDEX idx_step_inst_instance ON process_step_instances(instance_id);
CREATE INDEX idx_step_inst_status ON process_step_instances(status);
CREATE INDEX idx_step_inst_tenant ON process_step_instances(tenant_id);
CREATE INDEX idx_step_inst_step_id ON process_step_instances(step_id);
