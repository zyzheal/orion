-- Orion ITSM Ticket Service Database Migration
-- Version: 001
-- Description: Initialize ticket service core tables
-- Created: 2026-05-15
-- tenant_id convention: UUID NOT NULL per docs/standards/database-conventions.md

-- ============================================================
-- Core Ticket Tables
-- ============================================================

-- Tickets table
CREATE TABLE IF NOT EXISTS tickets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_number VARCHAR(50) UNIQUE NOT NULL,
    tenant_id UUID NOT NULL,
    type VARCHAR(50) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'new',
    priority VARCHAR(50) NOT NULL DEFAULT 'medium',
    title VARCHAR(500) NOT NULL,
    description TEXT,
    reporter_id VARCHAR(100) NOT NULL,
    assignee_id VARCHAR(100),
    group_id VARCHAR(100),
    category_id VARCHAR(100) NOT NULL,
    sub_category_id VARCHAR(100),
    source VARCHAR(50) NOT NULL DEFAULT 'web',
    tags JSONB DEFAULT '[]',
    attachments JSONB DEFAULT '[]',
    custom_fields JSONB DEFAULT '{}',
    sla_info JSONB,
    change_info JSONB,
    metadata JSONB DEFAULT '{}',
    due_date TIMESTAMP WITH TIME ZONE,
    resolved_at TIMESTAMP WITH TIME ZONE,
    closed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_tickets_tenant ON tickets(tenant_id);
CREATE INDEX idx_tickets_status ON tickets(status);
CREATE INDEX idx_tickets_priority ON tickets(priority);
CREATE INDEX idx_tickets_assignee ON tickets(assignee_id);
CREATE INDEX idx_tickets_group ON tickets(group_id);
CREATE INDEX idx_tickets_category ON tickets(category_id);
CREATE INDEX idx_tickets_created_at ON tickets(created_at);
CREATE INDEX idx_tickets_ticket_number ON tickets(ticket_number);

-- Ticket Comments table (denormalized tenant_id for RLS compatibility)
CREATE TABLE IF NOT EXISTS ticket_comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
    author_id VARCHAR(100) NOT NULL,
    content TEXT NOT NULL,
    is_public BOOLEAN DEFAULT true,
    is_internal BOOLEAN DEFAULT false,
    attachments JSONB DEFAULT '[]',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_ticket_comments_tenant ON ticket_comments(tenant_id);
CREATE INDEX idx_ticket_comments_ticket ON ticket_comments(ticket_id);
CREATE INDEX idx_ticket_comments_author ON ticket_comments(author_id);

-- Ticket History table (denormalized tenant_id for RLS compatibility)
CREATE TABLE IF NOT EXISTS ticket_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
    action VARCHAR(50) NOT NULL,
    from_status VARCHAR(50),
    to_status VARCHAR(50),
    actor_id VARCHAR(100) NOT NULL,
    comment TEXT,
    fields_changed JSONB DEFAULT '[]',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_ticket_history_tenant ON ticket_history(tenant_id);
CREATE INDEX idx_ticket_history_ticket ON ticket_history(ticket_id);
CREATE INDEX idx_ticket_history_created ON ticket_history(created_at);

-- Ticket Attachments table (denormalized tenant_id for RLS compatibility)
CREATE TABLE IF NOT EXISTS ticket_attachments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
    file_name VARCHAR(255) NOT NULL,
    file_size BIGINT NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    url VARCHAR(1000) NOT NULL,
    uploaded_by VARCHAR(100) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_ticket_attachments_tenant ON ticket_attachments(tenant_id);
CREATE INDEX idx_ticket_attachments_ticket ON ticket_attachments(ticket_id);

-- ============================================================
-- SLA Tables
-- ============================================================

-- SLA Policies table
CREATE TABLE IF NOT EXISTS sla_policies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    name VARCHAR(200) NOT NULL,
    description TEXT,
    enabled BOOLEAN DEFAULT true,
    ticket_type VARCHAR(50) NOT NULL,
    priority VARCHAR(50) NOT NULL,
    conditions JSONB DEFAULT '{}',
    metrics JSONB NOT NULL,
    escalation_rules JSONB DEFAULT '[]',
    schedule_id UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(tenant_id, name)
);

CREATE INDEX idx_sla_policies_tenant ON sla_policies(tenant_id);
CREATE INDEX idx_sla_policies_type_priority ON sla_policies(ticket_type, priority);

-- SLA Schedules table
CREATE TABLE IF NOT EXISTS sla_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    name VARCHAR(200) NOT NULL,
    timezone VARCHAR(50) NOT NULL DEFAULT 'UTC',
    work_hours JSONB NOT NULL,
    holidays JSONB DEFAULT '[]',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_sla_schedules_tenant ON sla_schedules(tenant_id);

-- SLA Reports table (for analytics)
CREATE TABLE IF NOT EXISTS sla_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    period_start TIMESTAMP WITH TIME ZONE NOT NULL,
    period_end TIMESTAMP WITH TIME ZONE NOT NULL,
    total_tickets INTEGER DEFAULT 0,
    within_sla INTEGER DEFAULT 0,
    breached INTEGER DEFAULT 0,
    compliance_rate DECIMAL(5,2) DEFAULT 0,
    avg_response_time INTEGER DEFAULT 0,
    avg_resolution_time INTEGER DEFAULT 0,
    by_priority JSONB DEFAULT '[]',
    by_category JSONB DEFAULT '[]',
    trends JSONB DEFAULT '[]',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_sla_reports_tenant ON sla_reports(tenant_id);
CREATE INDEX idx_sla_reports_period ON sla_reports(period_start, period_end);

-- ============================================================
-- Workflow Tables
-- ============================================================

-- Workflow Definitions table
CREATE TABLE IF NOT EXISTS workflow_definitions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    name VARCHAR(200) NOT NULL,
    description TEXT,
    ticket_type VARCHAR(50) NOT NULL,
    version INTEGER NOT NULL DEFAULT 1,
    enabled BOOLEAN DEFAULT true,
    nodes JSONB NOT NULL,
    edges JSONB NOT NULL,
    start_node_id VARCHAR(100) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_workflow_definitions_tenant ON workflow_definitions(tenant_id);
CREATE INDEX idx_workflow_definitions_type ON workflow_definitions(ticket_type);

-- Workflow Instances table (denormalized tenant_id for RLS compatibility)
CREATE TABLE IF NOT EXISTS workflow_instances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
    workflow_definition_id UUID NOT NULL REFERENCES workflow_definitions(id) ON DELETE CASCADE,
    current_node_id VARCHAR(100),
    status VARCHAR(50) NOT NULL DEFAULT 'running',
    node_instances JSONB DEFAULT '[]',
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_workflow_instances_tenant ON workflow_instances(tenant_id);
CREATE INDEX idx_workflow_instances_ticket ON workflow_instances(ticket_id);
CREATE INDEX idx_workflow_instances_status ON workflow_instances(status);

-- Approval Records table (denormalized tenant_id for RLS compatibility)
CREATE TABLE IF NOT EXISTS approval_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
    workflow_node_id VARCHAR(100) NOT NULL,
    approver_id VARCHAR(100) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    comment TEXT,
    approved_at TIMESTAMP WITH TIME ZONE,
    delegated_to VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_approval_records_tenant ON approval_records(tenant_id);
CREATE INDEX idx_approval_records_ticket ON approval_records(ticket_id);
CREATE INDEX idx_approval_records_approver ON approval_records(approver_id);
CREATE INDEX idx_approval_records_status ON approval_records(status);

-- ============================================================
-- Dispatch Tables
-- ============================================================

-- Dispatch Rules table
CREATE TABLE IF NOT EXISTS dispatch_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    name VARCHAR(200) NOT NULL,
    description TEXT,
    enabled BOOLEAN DEFAULT true,
    conditions JSONB DEFAULT '[]',
    strategy VARCHAR(50) NOT NULL DEFAULT 'round_robin',
    target_group_ids JSONB DEFAULT '[]',
    priority INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_dispatch_rules_tenant ON dispatch_rules(tenant_id);
CREATE INDEX idx_dispatch_rules_priority ON dispatch_rules(priority);

-- Dispatch Queue (for async dispatch processing)
-- References ticket which has tenant_id; denormalized for RLS
CREATE TABLE IF NOT EXISTS dispatch_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
    strategy VARCHAR(50) NOT NULL DEFAULT 'round_robin',
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    candidates JSONB DEFAULT '[]',
    selected_assignee VARCHAR(100),
    dispatched_at TIMESTAMP WITH TIME ZONE,
    accepted_at TIMESTAMP WITH TIME ZONE,
    rejected_by VARCHAR(100),
    rejection_reason TEXT,
    escalation_level INTEGER DEFAULT 0,
    max_escalation_level INTEGER DEFAULT 3,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_dispatch_queue_tenant ON dispatch_queue(tenant_id);
CREATE INDEX idx_dispatch_queue_ticket ON dispatch_queue(ticket_id);
CREATE INDEX idx_dispatch_queue_status ON dispatch_queue(status);

-- ============================================================
-- Service Catalog & Templates Tables
-- ============================================================

-- Service Catalog table
CREATE TABLE IF NOT EXISTS service_catalog (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    name VARCHAR(200) NOT NULL,
    description TEXT,
    category_id VARCHAR(100) NOT NULL,
    ticket_type VARCHAR(50) NOT NULL,
    sla_policy_id UUID REFERENCES sla_policies(id) ON DELETE SET NULL,
    template_id UUID,
    request_form JSONB DEFAULT '[]',
    visible BOOLEAN DEFAULT true,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_service_catalog_tenant ON service_catalog(tenant_id);
CREATE INDEX idx_service_catalog_category ON service_catalog(category_id);

-- Ticket Templates table
CREATE TABLE IF NOT EXISTS ticket_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    name VARCHAR(200) NOT NULL,
    description TEXT,
    ticket_type VARCHAR(50) NOT NULL,
    category_id VARCHAR(100) NOT NULL,
    sub_category_id VARCHAR(100),
    default_priority VARCHAR(50) NOT NULL DEFAULT 'medium',
    default_assignee_id VARCHAR(100),
    default_group_id VARCHAR(100),
    default_tags JSONB DEFAULT '[]',
    custom_field_defaults JSONB DEFAULT '{}',
    sla_policy_id UUID REFERENCES sla_policies(id) ON DELETE SET NULL,
    workflow_definition_id UUID REFERENCES workflow_definitions(id) ON DELETE SET NULL,
    enabled BOOLEAN DEFAULT true,
    usage_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_ticket_templates_tenant ON ticket_templates(tenant_id);
CREATE INDEX idx_ticket_templates_type ON ticket_templates(ticket_type);

-- ============================================================
-- Notification Tables
-- ============================================================

-- Ticket Notifications table (denormalized tenant_id for RLS compatibility)
CREATE TABLE IF NOT EXISTS ticket_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL,
    channel VARCHAR(50) NOT NULL,
    recipient_id VARCHAR(100) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    content JSONB NOT NULL,
    sent_at TIMESTAMP WITH TIME ZONE,
    error TEXT,
    retry_count INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 3,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_ticket_notifications_tenant ON ticket_notifications(tenant_id);
CREATE INDEX idx_ticket_notifications_ticket ON ticket_notifications(ticket_id);
CREATE INDEX idx_ticket_notifications_status ON ticket_notifications(status);
CREATE INDEX idx_ticket_notifications_recipient ON ticket_notifications(recipient_id);

-- ============================================================
-- Ticket Relations Tables
-- (denormalized tenant_id for RLS compatibility)
-- ============================================================

CREATE TABLE IF NOT EXISTS ticket_relations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    source_ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
    target_ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
    relation_type VARCHAR(50) NOT NULL,
    comment TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(source_ticket_id, target_ticket_id, relation_type)
);

CREATE INDEX idx_ticket_relations_tenant ON ticket_relations(tenant_id);
CREATE INDEX idx_ticket_relations_source ON ticket_relations(source_ticket_id);
CREATE INDEX idx_ticket_relations_target ON ticket_relations(target_ticket_id);

-- ============================================================
-- Satisfaction Survey Tables
-- (denormalized tenant_id for RLS compatibility)
-- ============================================================

CREATE TABLE IF NOT EXISTS satisfaction_surveys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
    sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    responded_at TIMESTAMP WITH TIME ZONE,
    rating INTEGER,
    comment TEXT,
    survey_link VARCHAR(1000) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'sent',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_satisfaction_surveys_tenant ON satisfaction_surveys(tenant_id);
CREATE INDEX idx_satisfaction_surveys_ticket ON satisfaction_surveys(ticket_id);
CREATE INDEX idx_satisfaction_surveys_status ON satisfaction_surveys(status);

-- ============================================================
-- Knowledge Association Tables
-- (denormalized tenant_id for RLS compatibility)
-- ============================================================

CREATE TABLE IF NOT EXISTS knowledge_associations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
    article_id VARCHAR(100) NOT NULL,
    article_title VARCHAR(500) NOT NULL,
    relevance_score DECIMAL(5,4) DEFAULT 0,
    associated_by VARCHAR(100) NOT NULL,
    associated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    was_helpful BOOLEAN
);

CREATE INDEX idx_knowledge_associations_tenant ON knowledge_associations(tenant_id);
CREATE INDEX idx_knowledge_associations_ticket ON knowledge_associations(ticket_id);
CREATE INDEX idx_knowledge_associations_article ON knowledge_associations(article_id);

-- ============================================================
-- Categories Tables (for ticket categorization)
-- ============================================================

CREATE TABLE IF NOT EXISTS ticket_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    parent_id UUID REFERENCES ticket_categories(id) ON DELETE CASCADE,
    name VARCHAR(200) NOT NULL,
    description TEXT,
    sla_policy_id UUID REFERENCES sla_policies(id) ON DELETE SET NULL,
    sort_order INTEGER DEFAULT 0,
    enabled BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_ticket_categories_tenant ON ticket_categories(tenant_id);
CREATE INDEX idx_ticket_categories_parent ON ticket_categories(parent_id);

-- ============================================================
-- BI Analytics Tables
-- ============================================================

CREATE TABLE IF NOT EXISTS bi_stats_cache (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    stats_type VARCHAR(50) NOT NULL,
    date_range_start DATE NOT NULL,
    date_range_end DATE NOT NULL,
    stats_data JSONB NOT NULL,
    computed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_bi_stats_cache_tenant ON bi_stats_cache(tenant_id);
CREATE INDEX idx_bi_stats_cache_type ON bi_stats_cache(stats_type);
CREATE INDEX idx_bi_stats_cache_date ON bi_stats_cache(date_range_start, date_range_end);

-- ============================================================
-- Enable Row Level Security
-- ============================================================

ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE tickets FORCE ROW LEVEL SECURITY;
ALTER TABLE ticket_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_comments FORCE ROW LEVEL SECURITY;
ALTER TABLE ticket_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_history FORCE ROW LEVEL SECURITY;
ALTER TABLE ticket_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_attachments FORCE ROW LEVEL SECURITY;
ALTER TABLE sla_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE sla_policies FORCE ROW LEVEL SECURITY;
ALTER TABLE sla_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE sla_schedules FORCE ROW LEVEL SECURITY;
ALTER TABLE workflow_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_definitions FORCE ROW LEVEL SECURITY;
ALTER TABLE workflow_instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_instances FORCE ROW LEVEL SECURITY;
ALTER TABLE approval_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE approval_records FORCE ROW LEVEL SECURITY;
ALTER TABLE dispatch_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE dispatch_rules FORCE ROW LEVEL SECURITY;
ALTER TABLE dispatch_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE dispatch_queue FORCE ROW LEVEL SECURITY;
ALTER TABLE service_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_catalog FORCE ROW LEVEL SECURITY;
ALTER TABLE ticket_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_templates FORCE ROW LEVEL SECURITY;
ALTER TABLE ticket_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_notifications FORCE ROW LEVEL SECURITY;
ALTER TABLE ticket_relations ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_relations FORCE ROW LEVEL SECURITY;
ALTER TABLE satisfaction_surveys ENABLE ROW LEVEL SECURITY;
ALTER TABLE satisfaction_surveys FORCE ROW LEVEL SECURITY;
ALTER TABLE knowledge_associations ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_associations FORCE ROW LEVEL SECURITY;
ALTER TABLE ticket_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_categories FORCE ROW LEVEL SECURITY;
ALTER TABLE bi_stats_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE bi_stats_cache FORCE ROW LEVEL SECURITY;

-- ============================================================
-- Create RLS Policies for Tenant Isolation
-- ============================================================

CREATE POLICY tenant_isolation_tickets ON tickets
    USING (tenant_id = current_setting('app.current_tenant', true)::UUID);

CREATE POLICY tenant_isolation_ticket_comments ON ticket_comments
    USING (tenant_id = current_setting('app.current_tenant', true)::UUID);

CREATE POLICY tenant_isolation_ticket_history ON ticket_history
    USING (tenant_id = current_setting('app.current_tenant', true)::UUID);

CREATE POLICY tenant_isolation_ticket_attachments ON ticket_attachments
    USING (tenant_id = current_setting('app.current_tenant', true)::UUID);

CREATE POLICY tenant_isolation_sla_policies ON sla_policies
    USING (tenant_id = current_setting('app.current_tenant', true)::UUID);

CREATE POLICY tenant_isolation_sla_schedules ON sla_schedules
    USING (tenant_id = current_setting('app.current_tenant', true)::UUID);

CREATE POLICY tenant_isolation_workflow_definitions ON workflow_definitions
    USING (tenant_id = current_setting('app.current_tenant', true)::UUID);

CREATE POLICY tenant_isolation_workflow_instances ON workflow_instances
    USING (tenant_id = current_setting('app.current_tenant', true)::UUID);

CREATE POLICY tenant_isolation_approval_records ON approval_records
    USING (tenant_id = current_setting('app.current_tenant', true)::UUID);

CREATE POLICY tenant_isolation_dispatch_rules ON dispatch_rules
    USING (tenant_id = current_setting('app.current_tenant', true)::UUID);

CREATE POLICY tenant_isolation_dispatch_queue ON dispatch_queue
    USING (tenant_id = current_setting('app.current_tenant', true)::UUID);

CREATE POLICY tenant_isolation_service_catalog ON service_catalog
    USING (tenant_id = current_setting('app.current_tenant', true)::UUID);

CREATE POLICY tenant_isolation_ticket_templates ON ticket_templates
    USING (tenant_id = current_setting('app.current_tenant', true)::UUID);

CREATE POLICY tenant_isolation_ticket_notifications ON ticket_notifications
    USING (tenant_id = current_setting('app.current_tenant', true)::UUID);

CREATE POLICY tenant_isolation_ticket_relations ON ticket_relations
    USING (tenant_id = current_setting('app.current_tenant', true)::UUID);

CREATE POLICY tenant_isolation_satisfaction_surveys ON satisfaction_surveys
    USING (tenant_id = current_setting('app.current_tenant', true)::UUID);

CREATE POLICY tenant_isolation_knowledge_associations ON knowledge_associations
    USING (tenant_id = current_setting('app.current_tenant', true)::UUID);

CREATE POLICY tenant_isolation_ticket_categories ON ticket_categories
    USING (tenant_id = current_setting('app.current_tenant', true)::UUID);

CREATE POLICY tenant_isolation_bi_stats_cache ON bi_stats_cache
    USING (tenant_id = current_setting('app.current_tenant', true)::UUID);

-- ============================================================
-- Insert default data
-- ============================================================

-- Default ticket categories
INSERT INTO ticket_categories (id, tenant_id, name, description, sort_order) VALUES
    ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000001', 'Infrastructure', 'Infrastructure related issues', 1),
    ('22222222-2222-2222-2222-222222222222', '00000000-0000-0000-0000-000000000001', 'Application', 'Application related issues', 2),
    ('33333333-3333-3333-3333-333333333333', '00000000-0000-0000-0000-000000000001', 'Network', 'Network related issues', 3),
    ('44444444-4444-4444-4444-444444444444', '00000000-0000-0000-0000-000000000001', 'Security', 'Security related issues', 4),
    ('55555555-5555-5555-5555-555555555555', '00000000-0000-0000-0000-000000000001', 'Data', 'Data related issues', 5)
ON CONFLICT DO NOTHING;

-- Default SLA policies
INSERT INTO sla_policies (id, tenant_id, name, description, ticket_type, priority, metrics) VALUES
    ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '00000000-0000-0000-0000-000000000001', 'Critical Response SLA', 'SLA for critical priority tickets', 'incident', 'critical',
     '[{"type": "response_time", "targetSeconds": 900, "warningThreshold": 0.8, "enabled": true}, {"type": "resolution_time", "targetSeconds": 14400, "warningThreshold": 0.8, "enabled": true}]'),
    ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '00000000-0000-0000-0000-000000000001', 'High Response SLA', 'SLA for high priority tickets', 'incident', 'high',
     '[{"type": "response_time", "targetSeconds": 3600, "warningThreshold": 0.8, "enabled": true}, {"type": "resolution_time", "targetSeconds": 28800, "warningThreshold": 0.8, "enabled": true}]'),
    ('cccccccc-cccc-cccc-cccc-cccccccccccc', '00000000-0000-0000-0000-000000000001', 'Medium Response SLA', 'SLA for medium priority tickets', 'incident', 'medium',
     '[{"type": "response_time", "targetSeconds": 14400, "warningThreshold": 0.8, "enabled": true}, {"type": "resolution_time", "targetSeconds": 172800, "warningThreshold": 0.8, "enabled": true}]')
ON CONFLICT DO NOTHING;

-- Default dispatch rules
INSERT INTO dispatch_rules (id, tenant_id, name, description, strategy, priority) VALUES
    ('dddddddd-dddd-dddd-dddd-dddddddddddd', '00000000-0000-0000-0000-000000000001', 'Default Round Robin', 'Default round robin dispatch', 'round_robin', 0),
    ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '00000000-0000-0000-0000-000000000001', 'Skill Based Dispatch', 'Skill based dispatch for complex issues', 'skill_based', 10)
ON CONFLICT DO NOTHING;
