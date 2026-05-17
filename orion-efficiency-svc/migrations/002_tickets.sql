-- Migration 002: Tickets Table for IT/DevOps Ticket Management
-- Supports ticket creation, SLA tracking, resolution metrics, and analytics.

CREATE TABLE IF NOT EXISTS tickets (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title           VARCHAR(500) NOT NULL,
  description     TEXT,
  status          VARCHAR(30) NOT NULL DEFAULT 'open',
  priority        VARCHAR(20) NOT NULL DEFAULT 'medium',
  category        VARCHAR(100) NOT NULL DEFAULT 'general',
  assignee        VARCHAR(255),
  requester       VARCHAR(255),
  tags            TEXT[] DEFAULT '{}',
  sla_deadline    TIMESTAMPTZ,
  sla_breached    BOOLEAN DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at     TIMESTAMPTZ,
  resolution_time_ms BIGINT,
  metadata        JSONB DEFAULT '{}'
);

CREATE INDEX idx_tickets_status ON tickets(status);
CREATE INDEX idx_tickets_priority ON tickets(priority);
CREATE INDEX idx_tickets_category ON tickets(category);
CREATE INDEX idx_tickets_created ON tickets(created_at);
CREATE INDEX idx_tickets_resolved ON tickets(resolved_at);
CREATE INDEX idx_tickets_sla_deadline ON tickets(sla_deadline);

-- Rollback:
-- DROP TABLE IF EXISTS tickets;
