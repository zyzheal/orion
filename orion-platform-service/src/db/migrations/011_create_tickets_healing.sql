-- Migration 011: Tickets & Self-Healing
-- Ticketing system and self-healing rules

CREATE TABLE IF NOT EXISTS tickets (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  title         VARCHAR(500) NOT NULL,
  description   TEXT,
  type          VARCHAR(50) NOT NULL DEFAULT 'incident',
  priority      VARCHAR(20) NOT NULL DEFAULT 'medium',
  status        VARCHAR(20) NOT NULL DEFAULT 'open',
  assignee_id   UUID REFERENCES users(id),
  reporter_id   UUID REFERENCES users(id),
  source        VARCHAR(50),
  source_id     VARCHAR(200),
  tags          TEXT[] DEFAULT '{}',
  resolved_at   TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_tickets_tenant ON tickets(tenant_id);
CREATE INDEX idx_tickets_status ON tickets(status);
CREATE INDEX idx_tickets_assignee ON tickets(assignee_id);
CREATE INDEX idx_tickets_priority ON tickets(priority);

-- Ticket comments
CREATE TABLE IF NOT EXISTS ticket_comments (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id     UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  author_id     UUID REFERENCES users(id),
  content       TEXT NOT NULL,
  is_internal   BOOLEAN NOT NULL DEFAULT false,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_ticket_comments_ticket ON ticket_comments(ticket_id);

-- Self-healing rules
CREATE TABLE IF NOT EXISTS self_healing_rules (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name          VARCHAR(200) NOT NULL,
  trigger_condition JSONB NOT NULL,
  action        JSONB NOT NULL,
  enabled       BOOLEAN NOT NULL DEFAULT true,
  execution_count INT NOT NULL DEFAULT 0,
  last_executed TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_healing_rules_tenant ON self_healing_rules(tenant_id);

-- Self-healing execution log
CREATE TABLE IF NOT EXISTS self_healing_executions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id       UUID NOT NULL REFERENCES self_healing_rules(id) ON DELETE CASCADE,
  trigger_event JSONB NOT NULL,
  status        VARCHAR(20) NOT NULL DEFAULT 'running',
  result        JSONB,
  error_message TEXT,
  started_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at  TIMESTAMPTZ
);
CREATE INDEX idx_healing_executions_rule ON self_healing_executions(rule_id);

-- Rollback:
-- DROP TABLE IF EXISTS self_healing_executions, self_healing_rules, ticket_comments, tickets;
