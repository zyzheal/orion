-- Migration 340: RDM Sprint Board
-- Sprint management: sprint, sprint_ticket, ticket_relation tables
-- Extends tickets table with sprint_id, story_points, acceptance_criteria

-- ==================== Sprint table ====================
CREATE TABLE IF NOT EXISTS sprint (
  id                  TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  tenant_id           VARCHAR(64) NOT NULL,
  name                VARCHAR(255) NOT NULL,
  goal                TEXT,
  start_date          DATE NOT NULL,
  end_date            DATE NOT NULL,
  status              VARCHAR(20) NOT NULL DEFAULT 'planning',
  capacity            INTEGER,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE sprint ENABLE ROW LEVEL SECURITY;
ALTER TABLE sprint FORCE ROW LEVEL SECURITY;
CREATE POLICY sprint_tenant_isolation ON sprint
    USING (tenant_id = current_setting('app.current_tenant_id', true));

CREATE INDEX idx_sprint_tenant ON sprint(tenant_id);
CREATE INDEX idx_sprint_status ON sprint(tenant_id, status);
CREATE INDEX idx_sprint_dates ON sprint(tenant_id, start_date, end_date);

-- ==================== Sprint-Ticket junction table ====================
CREATE TABLE IF NOT EXISTS sprint_ticket (
  id                  TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  tenant_id           VARCHAR(64) NOT NULL,
  sprint_id           TEXT NOT NULL,
  ticket_id           TEXT NOT NULL,
  sort_order          INTEGER DEFAULT 0,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(tenant_id, sprint_id, ticket_id)
);

ALTER TABLE sprint_ticket ENABLE ROW LEVEL SECURITY;
ALTER TABLE sprint_ticket FORCE ROW LEVEL SECURITY;
CREATE POLICY sprint_ticket_tenant_isolation ON sprint_ticket
    USING (tenant_id = current_setting('app.current_tenant_id', true));

CREATE INDEX idx_sprint_ticket_sprint ON sprint_ticket(sprint_id);
CREATE INDEX idx_sprint_ticket_ticket ON sprint_ticket(ticket_id);

-- ==================== Ticket Relation table ====================
CREATE TABLE IF NOT EXISTS ticket_relation (
  id                  TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  tenant_id           VARCHAR(64) NOT NULL,
  source_ticket_id    TEXT NOT NULL,
  target_ticket_id    TEXT NOT NULL,
  relation_type       VARCHAR(20) NOT NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(tenant_id, source_ticket_id, target_ticket_id, relation_type)
);

ALTER TABLE ticket_relation ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_relation FORCE ROW LEVEL SECURITY;
CREATE POLICY ticket_relation_tenant_isolation ON ticket_relation
    USING (tenant_id = current_setting('app.current_tenant_id', true));

CREATE INDEX idx_ticket_relation_source ON ticket_relation(source_ticket_id);
CREATE INDEX idx_ticket_relation_target ON ticket_relation(target_ticket_id);
CREATE INDEX idx_ticket_relation_type ON ticket_relation(relation_type);

-- ==================== Extend tickets table ====================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tickets' AND column_name = 'sprint_id') THEN
    ALTER TABLE tickets ADD COLUMN sprint_id TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tickets' AND column_name = 'story_points') THEN
    ALTER TABLE tickets ADD COLUMN story_points INTEGER;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tickets' AND column_name = 'acceptance_criteria') THEN
    ALTER TABLE tickets ADD COLUMN acceptance_criteria TEXT;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_tickets_sprint ON tickets(sprint_id);
