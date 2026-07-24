-- Migration 061: Ticketing Sub-Service Tables
-- Extends ticketing system with relations, assignments, dispatch rules,
-- transfers, and engineer suspension tables for PostgreSQL Repository pattern.

-- Ticket assignment history (who was assigned, when, by whom)
CREATE TABLE IF NOT EXISTS ticket_assignments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id       UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  assignee_id     UUID NOT NULL REFERENCES users(id),
  assigned_by     UUID REFERENCES users(id),
  assigned_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  reason          TEXT,
  match_score     DECIMAL(3,2)
);
CREATE INDEX idx_ticket_assignments_ticket ON ticket_assignments(ticket_id);
CREATE INDEX idx_ticket_assignments_assignee ON ticket_assignments(assignee_id);

-- Ticket relations (duplicates, caused-by, blocks, etc.)
CREATE TABLE IF NOT EXISTS ticket_relations (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id         UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  related_ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  relation_type     VARCHAR(20) NOT NULL,
  confidence        DECIMAL(3,2),
  description       TEXT,
  created_by        UUID REFERENCES users(id),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (ticket_id != related_ticket_id)
);
CREATE INDEX idx_ticket_relations_ticket ON ticket_relations(ticket_id);
CREATE INDEX idx_ticket_relations_related ON ticket_relations(related_ticket_id);
CREATE INDEX idx_ticket_relations_type ON ticket_relations(relation_type);

-- Dispatch rules for automatic ticket assignment
CREATE TABLE IF NOT EXISTS dispatch_rules (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            VARCHAR(200) NOT NULL,
  conditions      JSONB NOT NULL,
  assignee_id     UUID NOT NULL REFERENCES users(id),
  rule_priority   INT NOT NULL DEFAULT 0,
  enabled         BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_dispatch_rules_enabled ON dispatch_rules(enabled);
CREATE INDEX idx_dispatch_rules_priority ON dispatch_rules(rule_priority);

-- Ticket transfer history (engineer-to-engineer handoffs)
CREATE TABLE IF NOT EXISTS ticket_transfers (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id         UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  from_engineer_id  UUID NOT NULL REFERENCES users(id),
  to_engineer_id    UUID NOT NULL REFERENCES users(id),
  transfer_type     VARCHAR(20) NOT NULL DEFAULT 'manual',
  reason            TEXT NOT NULL,
  initiated_by      UUID REFERENCES users(id),
  transferred_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  hold_duration_ms  BIGINT,
  accepted          BOOLEAN NOT NULL DEFAULT true
);
CREATE INDEX idx_ticket_transfers_ticket ON ticket_transfers(ticket_id);
CREATE INDEX idx_ticket_transfers_from ON ticket_transfers(from_engineer_id);
CREATE INDEX idx_ticket_transfers_to ON ticket_transfers(to_engineer_id);
CREATE INDEX idx_ticket_transfers_type ON ticket_transfers(transfer_type);

-- Engineer suspension/leave management
CREATE TABLE IF NOT EXISTS engineer_suspensions (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  engineer_id         UUID NOT NULL REFERENCES users(id),
  reason              VARCHAR(20) NOT NULL,
  status              VARCHAR(20) NOT NULL DEFAULT 'scheduled',
  start_time          TIMESTAMPTZ NOT NULL,
  end_time            TIMESTAMPTZ NOT NULL,
  actual_end_time     TIMESTAMPTZ,
  backup_engineer_id  UUID REFERENCES users(id),
  auto_reassign       BOOLEAN NOT NULL DEFAULT true,
  pause_sla           BOOLEAN NOT NULL DEFAULT false,
  notes               TEXT,
  created_by          UUID REFERENCES users(id),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  tickets_reassigned  INT NOT NULL DEFAULT 0
);
CREATE INDEX idx_engineer_suspensions_engineer ON engineer_suspensions(engineer_id);
CREATE INDEX idx_engineer_suspensions_status ON engineer_suspensions(status);
CREATE INDEX idx_engineer_suspensions_start ON engineer_suspensions(start_time);

-- Dispatch weights configuration (per-tenant or global)
CREATE TABLE IF NOT EXISTS dispatch_weights (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID REFERENCES tenants(id),
  expertise     DECIMAL(3,2) NOT NULL DEFAULT 0.35,
  workload      DECIMAL(3,2) NOT NULL DEFAULT 0.25,
  availability  DECIMAL(3,2) NOT NULL DEFAULT 0.15,
  success_rate  DECIMAL(3,2) NOT NULL DEFAULT 0.15,
  sla_urgency   DECIMAL(3,2) NOT NULL DEFAULT 0.10,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX idx_dispatch_weights_tenant ON dispatch_weights(tenant_id) WHERE tenant_id IS NOT NULL;

-- Rollback:
-- DROP TABLE IF EXISTS dispatch_weights, engineer_suspensions, ticket_transfers, dispatch_rules, ticket_relations, ticket_assignments;
