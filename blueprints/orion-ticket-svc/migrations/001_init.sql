-- Migration 001: Ticket Service Core Tables
-- Creates all core tables for tickets, history, comments, workflows, SLA policies,
-- dispatch rules, relations, templates, notifications, and satisfaction surveys
-- Version: 1.0.0

-- ==================== Ticket Categories ====================
CREATE TABLE IF NOT EXISTS ticket_categories (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL,
  name            VARCHAR(255) NOT NULL,
  description     TEXT,
  parent_id       UUID REFERENCES ticket_categories(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_ticket_categories_tenant ON ticket_categories(tenant_id);
CREATE INDEX idx_ticket_categories_parent ON ticket_categories(parent_id);

-- ==================== Tickets ====================
CREATE TABLE IF NOT EXISTS tickets (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_number     VARCHAR(50) NOT NULL UNIQUE,
  tenant_id         UUID NOT NULL,
  type              VARCHAR(30) NOT NULL,
  status            VARCHAR(30) NOT NULL DEFAULT 'new',
  priority          VARCHAR(20) NOT NULL DEFAULT 'medium',
  title             VARCHAR(500) NOT NULL,
  description       TEXT NOT NULL,
  reporter_id       VARCHAR(255) NOT NULL,
  assignee_id       VARCHAR(255),
  group_id          VARCHAR(255),
  category_id       UUID NOT NULL REFERENCES ticket_categories(id),
  sub_category_id   UUID REFERENCES ticket_categories(id),
  source            VARCHAR(30) NOT NULL DEFAULT 'web',
  tags              JSONB NOT NULL DEFAULT '[]',
  attachments       JSONB DEFAULT '[]',
  custom_fields     JSONB DEFAULT '{}',
  sla_info          JSONB,
  change_info       JSONB,
  metadata          JSONB DEFAULT '{}',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at       TIMESTAMPTZ,
  closed_at         TIMESTAMPTZ,
  due_date          TIMESTAMPTZ
);

CREATE INDEX idx_tickets_tenant ON tickets(tenant_id);
CREATE INDEX idx_tickets_status ON tickets(status);
CREATE INDEX idx_tickets_priority ON tickets(priority);
CREATE INDEX idx_tickets_type ON tickets(type);
CREATE INDEX idx_tickets_assignee ON tickets(assignee_id);
CREATE INDEX idx_tickets_reporter ON tickets(reporter_id);
CREATE INDEX idx_tickets_group ON tickets(group_id);
CREATE INDEX idx_tickets_category ON tickets(category_id);
CREATE INDEX idx_tickets_created ON tickets(created_at);
CREATE INDEX idx_tickets_due ON tickets(due_date);
CREATE INDEX idx_tickets_number ON tickets(ticket_number);

-- ==================== Ticket History ====================
CREATE TABLE IF NOT EXISTS ticket_history (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id       UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  action          VARCHAR(50) NOT NULL,
  from_status     VARCHAR(30),
  to_status       VARCHAR(30),
  actor_id        VARCHAR(255) NOT NULL,
  comment         TEXT,
  fields_changed  JSONB DEFAULT '[]',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_ticket_history_ticket ON ticket_history(ticket_id);
CREATE INDEX idx_ticket_history_action ON ticket_history(action);
CREATE INDEX idx_ticket_history_actor ON ticket_history(actor_id);
CREATE INDEX idx_ticket_history_created ON ticket_history(created_at);

-- ==================== Ticket Comments ====================
CREATE TABLE IF NOT EXISTS ticket_comments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id       UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  author_id       VARCHAR(255) NOT NULL,
  content         TEXT NOT NULL,
  is_public       BOOLEAN NOT NULL DEFAULT true,
  is_internal     BOOLEAN NOT NULL DEFAULT false,
  attachments     JSONB DEFAULT '[]',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_ticket_comments_ticket ON ticket_comments(ticket_id);
CREATE INDEX idx_ticket_comments_author ON ticket_comments(author_id);
CREATE INDEX idx_ticket_comments_created ON ticket_comments(created_at);

-- ==================== SLA Policies ====================
CREATE TABLE IF NOT EXISTS sla_policies (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL,
  name              VARCHAR(255) NOT NULL,
  description       TEXT,
  enabled           BOOLEAN NOT NULL DEFAULT true,
  ticket_type       VARCHAR(30) NOT NULL,
  priority          VARCHAR(20) NOT NULL,
  conditions        JSONB NOT NULL DEFAULT '{}',
  metrics           JSONB NOT NULL DEFAULT '[]',
  escalation_rules  JSONB DEFAULT '[]',
  schedule_id       UUID,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_sla_policies_tenant ON sla_policies(tenant_id);
CREATE INDEX idx_sla_policies_type ON sla_policies(ticket_type);
CREATE INDEX idx_sla_policies_priority ON sla_policies(priority);
CREATE INDEX idx_sla_policies_enabled ON sla_policies(enabled);

-- ==================== SLA Schedules ====================
CREATE TABLE IF NOT EXISTS sla_schedules (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL,
  name            VARCHAR(255) NOT NULL,
  timezone        VARCHAR(50) NOT NULL DEFAULT 'Asia/Shanghai',
  work_hours      JSONB NOT NULL DEFAULT '[]',
  holidays        JSONB DEFAULT '[]',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_sla_schedules_tenant ON sla_schedules(tenant_id);

-- ==================== Workflow Definitions ====================
CREATE TABLE IF NOT EXISTS workflow_definitions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL,
  name              VARCHAR(255) NOT NULL,
  description       TEXT,
  ticket_type       VARCHAR(30) NOT NULL,
  version           INTEGER NOT NULL DEFAULT 1,
  enabled           BOOLEAN NOT NULL DEFAULT true,
  nodes             JSONB NOT NULL DEFAULT '[]',
  edges             JSONB NOT NULL DEFAULT '[]',
  start_node_id     VARCHAR(100),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_workflow_defs_tenant ON workflow_definitions(tenant_id);
CREATE INDEX idx_workflow_defs_type ON workflow_definitions(ticket_type);
CREATE INDEX idx_workflow_defs_enabled ON workflow_definitions(enabled);

-- ==================== Workflow Instances ====================
CREATE TABLE IF NOT EXISTS workflow_instances (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id             UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  workflow_definition_id UUID NOT NULL REFERENCES workflow_definitions(id),
  current_node_id       VARCHAR(100),
  status                VARCHAR(20) NOT NULL DEFAULT 'running',
  node_instances        JSONB NOT NULL DEFAULT '[]',
  started_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at          TIMESTAMPTZ
);

CREATE INDEX idx_workflow_instances_ticket ON workflow_instances(ticket_id);
CREATE INDEX idx_workflow_instances_status ON workflow_instances(status);

-- ==================== Approval Records ====================
CREATE TABLE IF NOT EXISTS approval_records (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id         UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  workflow_node_id  VARCHAR(100),
  approver_id       VARCHAR(255) NOT NULL,
  status            VARCHAR(20) NOT NULL DEFAULT 'pending',
  comment           TEXT,
  approved_at       TIMESTAMPTZ,
  delegated_to      VARCHAR(255)
);

CREATE INDEX idx_approval_records_ticket ON approval_records(ticket_id);
CREATE INDEX idx_approval_records_approver ON approval_records(approver_id);
CREATE INDEX idx_approval_records_status ON approval_records(status);

-- ==================== Dispatch Rules ====================
CREATE TABLE IF NOT EXISTS dispatch_rules (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL,
  name            VARCHAR(255) NOT NULL,
  description     TEXT,
  enabled         BOOLEAN NOT NULL DEFAULT true,
  conditions      JSONB NOT NULL DEFAULT '[]',
  strategy        VARCHAR(30) NOT NULL,
  target_group_ids JSONB NOT NULL DEFAULT '[]',
  priority        INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_dispatch_rules_tenant ON dispatch_rules(tenant_id);
CREATE INDEX idx_dispatch_rules_enabled ON dispatch_rules(enabled);
CREATE INDEX idx_dispatch_rules_strategy ON dispatch_rules(strategy);

-- ==================== Dispatch Results ====================
CREATE TABLE IF NOT EXISTS dispatch_results (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id         UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  status            VARCHAR(20) NOT NULL DEFAULT 'pending',
  assigned_to       VARCHAR(255),
  candidates        JSONB DEFAULT '[]',
  match_details     JSONB DEFAULT '[]',
  dispatched_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  accepted_at       TIMESTAMPTZ,
  rejected_by       VARCHAR(255),
  rejection_reason  TEXT,
  escalation_level  INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX idx_dispatch_results_ticket ON dispatch_results(ticket_id);
CREATE INDEX idx_dispatch_results_status ON dispatch_results(status);
CREATE INDEX idx_dispatch_results_assigned ON dispatch_results(assigned_to);

-- ==================== Ticket Relations ====================
CREATE TABLE IF NOT EXISTS ticket_relations (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_ticket_id  UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  target_ticket_id  UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  relation_type     VARCHAR(20) NOT NULL,
  comment           TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_ticket_relations_source ON ticket_relations(source_ticket_id);
CREATE INDEX idx_ticket_relations_target ON ticket_relations(target_ticket_id);
CREATE INDEX idx_ticket_relations_type ON ticket_relations(relation_type);

-- ==================== Ticket Templates ====================
CREATE TABLE IF NOT EXISTS ticket_templates (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID NOT NULL,
  name                  VARCHAR(255) NOT NULL,
  description           TEXT,
  ticket_type           VARCHAR(30) NOT NULL,
  category_id           UUID NOT NULL,
  sub_category_id       UUID,
  default_priority      VARCHAR(20) NOT NULL DEFAULT 'medium',
  default_assignee_id   VARCHAR(255),
  default_group_id      VARCHAR(255),
  default_tags          JSONB DEFAULT '[]',
  custom_field_defaults JSONB DEFAULT '{}',
  sla_policy_id         UUID REFERENCES sla_policies(id),
  workflow_definition_id UUID REFERENCES workflow_definitions(id),
  enabled               BOOLEAN NOT NULL DEFAULT true,
  usage_count           INTEGER NOT NULL DEFAULT 0,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_ticket_templates_tenant ON ticket_templates(tenant_id);
CREATE INDEX idx_ticket_templates_type ON ticket_templates(ticket_type);
CREATE INDEX idx_ticket_templates_enabled ON ticket_templates(enabled);

-- ==================== Ticket Notifications ====================
CREATE TABLE IF NOT EXISTS ticket_notifications (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id       UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  type            VARCHAR(50) NOT NULL,
  channel         VARCHAR(20) NOT NULL,
  recipient_id    VARCHAR(255) NOT NULL,
  status          VARCHAR(20) NOT NULL DEFAULT 'pending',
  content         JSONB NOT NULL DEFAULT '{}',
  sent_at         TIMESTAMPTZ,
  error           TEXT,
  retry_count     INTEGER NOT NULL DEFAULT 0,
  max_retries     INTEGER NOT NULL DEFAULT 3,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_ticket_notifications_ticket ON ticket_notifications(ticket_id);
CREATE INDEX idx_ticket_notifications_recipient ON ticket_notifications(recipient_id);
CREATE INDEX idx_ticket_notifications_status ON ticket_notifications(status);
CREATE INDEX idx_ticket_notifications_channel ON ticket_notifications(channel);

-- ==================== Satisfaction Surveys ====================
CREATE TABLE IF NOT EXISTS satisfaction_surveys (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id       UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  sent_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  responded_at    TIMESTAMPTZ,
  rating          INTEGER CHECK (rating >= 1 AND rating <= 5),
  comment         TEXT,
  survey_link     VARCHAR(1000),
  status          VARCHAR(20) NOT NULL DEFAULT 'sent'
);

CREATE INDEX idx_satisfaction_surveys_ticket ON satisfaction_surveys(ticket_id);
CREATE INDEX idx_satisfaction_surveys_status ON satisfaction_surveys(status);
CREATE INDEX idx_satisfaction_surveys_rating ON satisfaction_surveys(rating);

-- ==================== Service Catalog ====================
CREATE TABLE IF NOT EXISTS service_catalog (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL,
  name            VARCHAR(255) NOT NULL,
  description     TEXT,
  category_id     UUID NOT NULL,
  ticket_type     VARCHAR(30) NOT NULL,
  sla_policy_id   UUID REFERENCES sla_policies(id),
  template_id     UUID REFERENCES ticket_templates(id),
  request_form    JSONB DEFAULT '[]',
  visible         BOOLEAN NOT NULL DEFAULT true,
  sort_order      INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_service_catalog_tenant ON service_catalog(tenant_id);
CREATE INDEX idx_service_catalog_category ON service_catalog(category_id);
CREATE INDEX idx_service_catalog_visible ON service_catalog(visible);

-- ==================== Knowledge Associations ====================
CREATE TABLE IF NOT EXISTS knowledge_associations (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id         UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  article_id        VARCHAR(255) NOT NULL,
  article_title     VARCHAR(500) NOT NULL,
  relevance_score   DECIMAL(5, 4),
  associated_by     VARCHAR(255) NOT NULL,
  associated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  was_helpful       BOOLEAN
);

CREATE INDEX idx_knowledge_associations_ticket ON knowledge_associations(ticket_id);
CREATE INDEX idx_knowledge_associations_article ON knowledge_associations(article_id);

-- ==================== Migration Info ====================
CREATE TABLE IF NOT EXISTS ticket_schema_migrations (
  version             VARCHAR(20) PRIMARY KEY,
  applied_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  description         TEXT
);

INSERT INTO ticket_schema_migrations (version, description)
VALUES ('001', 'Initial ticket service tables: categories, tickets, history, comments, sla_policies, sla_schedules, workflows, approvals, dispatch, relations, templates, notifications, surveys, service_catalog');
