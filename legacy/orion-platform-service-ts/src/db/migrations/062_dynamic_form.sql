-- Migration 062: Dynamic Form Engine (Migration 336)
-- Dynamic form definitions, field definitions, and form data instances

CREATE TABLE IF NOT EXISTS form_definitions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       VARCHAR(64) NOT NULL,
  name            VARCHAR(255) NOT NULL,
  description     TEXT,
  version         INTEGER NOT NULL DEFAULT 1,
  layout          VARCHAR(32) NOT NULL DEFAULT 'vertical',  -- 'vertical' | 'horizontal' | 'grid'
  enabled         BOOLEAN NOT NULL DEFAULT true,
  created_by      VARCHAR(64),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, name, version)
);

-- RLS multi-tenant isolation
ALTER TABLE form_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE form_definitions FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON form_definitions USING (tenant_id = current_setting('app.current_tenant_id', true));

CREATE INDEX idx_form_def_tenant ON form_definitions(tenant_id);
CREATE INDEX idx_form_def_enabled ON form_definitions(enabled) WHERE enabled = true;

-- Form field definitions
CREATE TABLE IF NOT EXISTS form_field_definitions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       VARCHAR(64) NOT NULL,
  form_id         UUID NOT NULL REFERENCES form_definitions(id) ON DELETE CASCADE,
  field_key       VARCHAR(128) NOT NULL,
  field_type      VARCHAR(32) NOT NULL,           -- text/number/select/multiselect/date/datetime/user/ref/textarea/switch/radio/checkbox/cascader/upload/rich-text
  label           VARCHAR(255) NOT NULL,
  placeholder     VARCHAR(255),
  required        BOOLEAN NOT NULL DEFAULT false,
  default_value   JSONB,
  options         JSONB,                          -- select/radio/checkbox option list
  rules           JSONB,                          -- validation rules (pattern/min/max/len/custom)
  visible_when    JSONB,                          -- conditional visibility
  required_when   JSONB,                          -- conditional required
  sort_order      INTEGER NOT NULL DEFAULT 0,
  props           JSONB,                          -- extended properties (rows/maxCount etc.)
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS multi-tenant isolation
ALTER TABLE form_field_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE form_field_definitions FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON form_field_definitions USING (tenant_id = current_setting('app.current_tenant_id', true));

CREATE INDEX idx_form_field_form ON form_field_definitions(form_id);
CREATE INDEX idx_form_field_tenant ON form_field_definitions(tenant_id);

-- Form data instances
CREATE TABLE IF NOT EXISTS form_instances (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       VARCHAR(64) NOT NULL,
  definition_id   UUID NOT NULL REFERENCES form_definitions(id),
  entity_type     VARCHAR(32) NOT NULL,           -- ticket, change, etc.
  entity_id       VARCHAR(64) NOT NULL,
  form_data       JSONB NOT NULL,                 -- user-submitted data
  submitted_by    VARCHAR(64),
  submitted_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS multi-tenant isolation
ALTER TABLE form_instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE form_instances FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON form_instances USING (tenant_id = current_setting('app.current_tenant_id', true));

CREATE INDEX idx_form_inst_entity ON form_instances(entity_type, entity_id);
CREATE INDEX idx_form_inst_def ON form_instances(definition_id);
CREATE INDEX idx_form_inst_tenant ON form_instances(tenant_id);
