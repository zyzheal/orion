-- Migration 414: Ticket Templates & Automation Rules
-- Adds ticket templates for quick creation and automation rules
-- for ITSM self-service capabilities.

-- Ticket templates (predefined ticket configurations)
CREATE TABLE IF NOT EXISTS ticket_templates (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name            VARCHAR(200) NOT NULL,
  description     TEXT,
  title           VARCHAR(500) NOT NULL,
  template_body   TEXT NOT NULL,
  category        VARCHAR(50) NOT NULL DEFAULT 'other',
  priority        VARCHAR(20) NOT NULL DEFAULT 'medium',
  status          VARCHAR(20) NOT NULL DEFAULT 'open',
  assignee_id     UUID REFERENCES users(id),
  tags            TEXT[] DEFAULT '{}',
  sla_target_id   UUID,
  workflow_steps  JSONB,
  field_defaults  JSONB NOT NULL DEFAULT '{}',
  metadata        JSONB NOT NULL DEFAULT '{}',
  is_public       BOOLEAN NOT NULL DEFAULT false,
  usage_count     INT NOT NULL DEFAULT 0,
  created_by      UUID REFERENCES users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_ticket_templates_tenant ON ticket_templates(tenant_id);
CREATE INDEX idx_ticket_templates_category ON ticket_templates(category);
CREATE INDEX idx_ticket_templates_priority ON ticket_templates(priority);
CREATE INDEX idx_ticket_templates_public ON ticket_templates(is_public);

-- Automation rules for tickets
CREATE TABLE IF NOT EXISTS automation_rules (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name            VARCHAR(200) NOT NULL,
  description     TEXT,
  enabled         BOOLEAN NOT NULL DEFAULT true,
  priority        INT NOT NULL DEFAULT 0,
  conditions      JSONB NOT NULL DEFAULT '{}',
  actions         JSONB NOT NULL DEFAULT '[]',
  execution_count INT NOT NULL DEFAULT 0,
  last_executed   TIMESTAMPTZ,
  created_by      UUID REFERENCES users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_automation_rules_tenant ON automation_rules(tenant_id);
CREATE INDEX idx_automation_rules_enabled ON automation_rules(enabled);
CREATE INDEX idx_automation_rules_priority ON automation_rules(priority);

-- Automation rule execution log
CREATE TABLE IF NOT EXISTS automation_rule_executions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id         UUID NOT NULL REFERENCES automation_rules(id) ON DELETE CASCADE,
  ticket_id       UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  triggered_by    VARCHAR(50) NOT NULL,
  conditions_met  JSONB NOT NULL DEFAULT '{}',
  actions_taken   JSONB NOT NULL DEFAULT '[]',
  status          VARCHAR(20) NOT NULL DEFAULT 'running',
  error_message   TEXT,
  executed_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at    TIMESTAMPTZ
);
CREATE INDEX idx_automation_executions_rule ON automation_rule_executions(rule_id);
CREATE INDEX idx_automation_executions_ticket ON automation_rule_executions(ticket_id);
CREATE INDEX idx_automation_executions_status ON automation_rule_executions(status);

-- Rollback:
-- DROP TABLE IF EXISTS automation_rule_executions, automation_rules, ticket_templates;
