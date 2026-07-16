-- Migration 177: Workflow Triggers and Tasks
--
-- Creates tables for workflow trigger configuration and manual task management
-- Supports event triggers, cron triggers, manual triggers, and webhook triggers

-- ============================================================
-- 1. Workflow Triggers Configuration Table
-- ============================================================
CREATE TABLE IF NOT EXISTS workflow_triggers (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workflow_id         VARCHAR(255) NOT NULL,
    name                VARCHAR(100) NOT NULL,
    type                VARCHAR(20) NOT NULL,  -- 'event' | 'cron' | 'manual' | 'webhook'
    enabled             BOOLEAN NOT NULL DEFAULT true,
    event_type          VARCHAR(100),           -- e.g., 'ticket.created', 'pipeline.completed'
    event_filter        JSONB DEFAULT '{}',     -- Event filtering conditions
    cron_expression     VARCHAR(100),           -- Cron expression for scheduled triggers
    timezone            VARCHAR(50) DEFAULT 'Asia/Shanghai',
    webhook_path        VARCHAR(200),           -- Custom webhook path
    webhook_secret      VARCHAR(200),           -- Secret for webhook signature validation
    trigger_strategy    VARCHAR(20) DEFAULT 'async',  -- 'async' | 'sync'
    concurrency_limit   INTEGER DEFAULT 1,      -- Max concurrent executions
    description         TEXT,
    created_by          VARCHAR(100),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for workflow_triggers
CREATE INDEX idx_wt_workflow ON workflow_triggers(workflow_id);
CREATE INDEX idx_wt_type ON workflow_triggers(type);
CREATE INDEX idx_wt_enabled ON workflow_triggers(enabled);
CREATE INDEX idx_wt_event_type ON workflow_triggers(event_type);

-- ============================================================
-- 2. Workflow Trigger Logs Table
-- ============================================================
CREATE TABLE IF NOT EXISTS workflow_trigger_logs (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trigger_id          UUID NOT NULL REFERENCES workflow_triggers(id) ON DELETE CASCADE,
    workflow_instance_id VARCHAR(255),
    event_type          VARCHAR(100),
    event_payload       JSONB DEFAULT '{}',
    status              VARCHAR(20) NOT NULL DEFAULT 'pending',  -- 'pending' | 'success' | 'failed' | 'skipped'
    error_message       TEXT,
    execution_time_ms   INTEGER,
    triggered_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for workflow_trigger_logs
CREATE INDEX idx_wtl_trigger ON workflow_trigger_logs(trigger_id);
CREATE INDEX idx_wtl_status ON workflow_trigger_logs(status);
CREATE INDEX idx_wtl_triggered ON workflow_trigger_logs(triggered_at DESC);

-- ============================================================
-- 3. Workflow Manual Tasks Table
-- ============================================================
CREATE TABLE IF NOT EXISTS workflow_tasks (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    instance_id         VARCHAR(255) NOT NULL,  -- FK to cross_domain_executions
    node_id             VARCHAR(100) NOT NULL,  -- Node ID in workflow graph
    task_type           VARCHAR(20) NOT NULL DEFAULT 'manual',  -- 'manual' | 'system'
    assignee_type       VARCHAR(20),            -- 'user' | 'role'
    assignee_id         VARCHAR(100),
    candidate_users     VARCHAR(100)[] DEFAULT '{}',
    candidate_roles     VARCHAR(100)[] DEFAULT '{}',
    title               VARCHAR(200) NOT NULL,
    description         TEXT,
    form_data           JSONB DEFAULT '{}',     -- Form schema and data for manual input
    status              VARCHAR(20) NOT NULL DEFAULT 'pending',  -- 'pending' | 'assigned' | 'completed' | 'rejected' | 'cancelled'
    priority            VARCHAR(20) DEFAULT 'normal',  -- 'low' | 'normal' | 'high' | 'urgent'
    due_date            TIMESTAMPTZ,
    completed_at        TIMESTAMPTZ,
    completed_by        VARCHAR(100),
    completion_comment  TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for workflow_tasks
CREATE INDEX idx_wft_instance ON workflow_tasks(instance_id);
CREATE INDEX idx_wft_assignee ON workflow_tasks(assignee_type, assignee_id);
CREATE INDEX idx_wft_status ON workflow_tasks(status);
CREATE INDEX idx_wft_priority ON workflow_tasks(priority);
CREATE INDEX idx_wft_due_date ON workflow_tasks(due_date);
CREATE INDEX idx_wft_created ON workflow_tasks(created_at DESC);

-- ============================================================
-- 4. Add Foreign Key Constraints (with existence check)
-- ============================================================
DO $$
BEGIN
    -- Check if cross_domain_workflows exists before adding FK
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'cross_domain_workflows') THEN
        ALTER TABLE workflow_triggers
            ADD CONSTRAINT fk_wt_workflow
            FOREIGN KEY (workflow_id) REFERENCES cross_domain_workflows(id) ON DELETE CASCADE;
    END IF;

    -- Check if cross_domain_executions exists before adding FK
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'cross_domain_executions') THEN
        ALTER TABLE workflow_tasks
            ADD CONSTRAINT fk_wft_instance
            FOREIGN KEY (instance_id) REFERENCES cross_domain_executions(id) ON DELETE CASCADE;
    END IF;
END $$;

-- ============================================================
-- 5. Add unique constraint for workflow_triggers name (optional for sample data)
-- ============================================================
-- Note: Sample data commented out as workflow_ids may not exist yet
-- Uncomment and update workflow_id values when cross_domain_workflows have data:
--
-- INSERT INTO workflow_triggers (workflow_id, name, type, event_type, description, enabled)
-- VALUES
--     ('system-health-check', 'System Health Check', 'cron', NULL, 'Daily health check workflow', false),
--     ('ticket-auto-assign', 'Ticket Auto Assignment', 'event', 'ticket.created', 'Auto-assign new tickets', false),
--     ('pipeline-alert', 'Pipeline Alert Handler', 'event', 'pipeline.failed', 'Handle pipeline failure events', false),
--     ('manual-trigger', 'Manual Workflow Trigger', 'manual', NULL, 'Allow manual workflow trigger', true)
-- ON CONFLICT DO NOTHING;

-- ============================================================
-- Rollback:
-- DROP TABLE IF EXISTS workflow_trigger_logs;
-- DROP TABLE IF EXISTS workflow_tasks;
-- DROP TABLE IF EXISTS workflow_triggers;