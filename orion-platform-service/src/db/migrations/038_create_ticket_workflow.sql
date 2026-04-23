-- Migration 038: Ticket Workflow

CREATE TABLE IF NOT EXISTS ticket_workflow_history (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id       UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  from_status     VARCHAR(20) NOT NULL,
  to_status       VARCHAR(20) NOT NULL,
  triggered_by    UUID,
  triggered_type  VARCHAR(50) NOT NULL DEFAULT 'manual',
  comment         TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_ticket_workflow_ticket ON ticket_workflow_history(ticket_id);
CREATE INDEX idx_ticket_workflow_created ON ticket_workflow_history(created_at DESC);

CREATE TABLE IF NOT EXISTS ticket_sla (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id       UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE UNIQUE,
  priority        VARCHAR(20) NOT NULL,
  response_time_minutes INT NOT NULL,
  resolution_time_minutes INT NOT NULL,
  first_response_at TIMESTAMPTZ,
  resolved_at     TIMESTAMPTZ,
  response_breached BOOLEAN NOT NULL DEFAULT false,
  resolution_breached BOOLEAN NOT NULL DEFAULT false,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_ticket_sla_breached ON ticket_sla(response_breached, resolution_breached);

CREATE TABLE IF NOT EXISTS dispatch_queue (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id       UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE UNIQUE,
  assigned_to     UUID,
  queue_status    VARCHAR(20) NOT NULL DEFAULT 'pending',
  priority_score  DECIMAL(5,2),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_dispatch_queue_status ON dispatch_queue(queue_status);

CREATE TABLE IF NOT EXISTS engineer_load (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL UNIQUE,
  current_load    INT NOT NULL DEFAULT 0,
  max_capacity    INT NOT NULL DEFAULT 10,
  specialization  TEXT[] NOT NULL DEFAULT '{}',
  availability    VARCHAR(20) NOT NULL DEFAULT 'available',
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_engineer_load_availability ON engineer_load(availability);

-- Rollback:
-- DROP TABLE IF EXISTS engineer_load, dispatch_queue, ticket_sla, ticket_workflow_history;
