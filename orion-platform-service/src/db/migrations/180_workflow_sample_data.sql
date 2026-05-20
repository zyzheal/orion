-- Migration 180: Workflow Sample Data
--
-- Inserts sample workflow definitions and triggers for demonstration
-- This enables the frontend pages to display real data

-- ============================================================
-- 1. Create workflow definition table if not exists
-- ============================================================
CREATE TABLE IF NOT EXISTS lowcode_workflow_definition (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           VARCHAR(100) DEFAULT 'default',
    name                VARCHAR(100) NOT NULL,
    description         TEXT,
    version             INTEGER DEFAULT 1,
    enabled             BOOLEAN NOT NULL DEFAULT true,
    nodes               JSONB NOT NULL DEFAULT '[]',
    edges               JSONB NOT NULL DEFAULT '[]',
    created_by          VARCHAR(100),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_lwd_tenant ON lowcode_workflow_definition(tenant_id);
CREATE INDEX IF NOT EXISTS idx_lwd_enabled ON lowcode_workflow_definition(enabled);
CREATE INDEX IF NOT EXISTS idx_lwd_created ON lowcode_workflow_definition(created_at DESC);

-- ============================================================
-- 2. Create workflow instance table if not exists
-- ============================================================
CREATE TABLE IF NOT EXISTS lowcode_workflow_instance (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workflow_id         VARCHAR(255) NOT NULL,
    workflow_definition_id UUID NOT NULL,
    tenant_id           VARCHAR(100) DEFAULT 'default',
    status              VARCHAR(20) NOT NULL DEFAULT 'pending',  -- 'pending' | 'running' | 'suspended' | 'completed' | 'failed' | 'cancelled'
    current_node_id     VARCHAR(100),
    variables           JSONB DEFAULT '{}',
    history             JSONB DEFAULT '[]',
    input               JSONB DEFAULT '{}',
    output              JSONB,
    error               TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at        TIMESTAMPTZ
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_lwi_workflow ON lowcode_workflow_instance(workflow_id);
CREATE INDEX IF NOT EXISTS idx_lwi_definition ON lowcode_workflow_instance(workflow_definition_id);
CREATE INDEX IF NOT EXISTS idx_lwi_status ON lowcode_workflow_instance(status);
CREATE INDEX IF NOT EXISTS idx_lwi_created ON lowcode_workflow_instance(created_at DESC);

-- ============================================================
-- 3. Insert sample workflow definitions
-- ============================================================
INSERT INTO lowcode_workflow_definition (id, tenant_id, name, description, version, enabled, nodes, edges, created_by)
VALUES
    ('wf-001', 'default', 'IT Support Ticket Flow', 'Standard IT support ticket processing workflow with approval', 1, true,
     '[{"id":"start","type":"start","name":"Start","config":{"outputVariables":{}}},{"id":"create-ticket","type":"task","name":"Create Ticket","config":{"title":"Create Support Ticket","description":"Create a new support ticket","assigneeType":"user","assigneeIds":["admin"]}},{"id":"approval","type":"approval","name":"Manager Approval","config":{"approverType":"role","approverIds":["manager"],"timeout":24,"timeoutAction":"approve"}},{"id":"notify","type":"notification","name":"Notify Requester","config":{"channels":["email"],"template":"Your ticket has been approved"}},{"id":"end","type":"end","name":"End","config":{}}]',
     '[{"source":"start","target":"create-ticket"},{"source":"create-ticket","target":"approval"},{"source":"approval","target":"notify"},{"source":"notify","target":"end"}]',
     'system'),

    ('wf-002', 'default', 'Daily Health Check', 'Automated daily system health check workflow', 1, true,
     '[{"id":"start","type":"start","name":"Start","config":{}},{"id":"check-services","type":"task","name":"Check Services","config":{"title":"Check Service Health","taskType":"system"}},{"id":"delay","type":"delay","name":"Wait 5 Minutes","config":{"duration":300}},{"id":"check-db","type":"task","name":"Check Database","config":{"title":"Check Database Connection","taskType":"system"}},{"id":"end","type":"end","name":"End","config":{}}]',
     '[{"source":"start","target":"check-services"},{"source":"check-services","target":"delay"},{"source":"delay","target":"check-db"},{"source":"check-db","target":"end"}]',
     'system'),

    ('wf-003', 'default', 'CI/CD Pipeline Trigger', 'Triggered by code push events to start CI pipeline', 1, true,
     '[{"id":"start","type":"start","name":"Start","config":{}},{"id":"build","type":"webhook","name":"Trigger Build","config":{"url":"https://ci.example.com/build","method":"POST","timeout":30000}},{"id":"test","type":"webhook","name":"Run Tests","config":{"url":"https://ci.example.com/test","method":"POST","timeout":60000}},{"id":"deploy","type":"webhook","name":"Deploy to Staging","config":{"url":"https://ci.example.com/deploy","method":"POST","timeout":120000}},{"id":"end","type":"end","name":"End","config":{}}]',
     '[{"source":"start","target":"build"},{"source":"build","target":"test"},{"source":"test","target":"deploy"},{"source":"deploy","target":"end"}]',
     'system'),

    ('wf-004', 'default', 'Employee Onboarding', 'New employee onboarding workflow with multiple approvals', 1, false,
     '[{"id":"start","type":"start","name":"Start","config":{}},{"id":"create-account","type":"task","name":"Create Account","config":{"title":"Create employee account"}},{"id":"hr-approval","type":"approval","name":"HR Approval","config":{"approverType":"role","approverIds":["hr-manager"]}},{"id":"it-approval","type":"approval","name":"IT Approval","config":{"approverType":"role","approverIds":["it-manager"]}},{"id":"setup-equipment","type":"task","name":"Setup Equipment","config":{"title":"Prepare laptop and equipment"}},{"id":"end","type":"end","name":"End","config":{}}]',
     '[{"source":"start","target":"create-account"},{"source":"create-account","target":"hr-approval"},{"source":"hr-approval","target":"it-approval"},{"source":"it-approval","target":"setup-equipment"},{"source":"setup-equipment","target":"end"}]',
     'system')
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 4. Insert sample workflow triggers
-- ============================================================
INSERT INTO workflow_triggers (id, workflow_id, name, type, enabled, event_type, event_filter, description, created_by)
VALUES
    ('trig-001', 'wf-001', 'Ticket Created Trigger', 'event', true, 'ticket.created', '{"priority":"high"}', 'Trigger when high priority ticket is created', 'system'),
    ('trig-002', 'wf-001', 'Ticket Auto Assign', 'event', true, 'ticket.created', '{}', 'Trigger when any ticket is created', 'system'),
    ('trig-003', 'wf-002', 'Daily Health Check', 'cron', true, NULL, NULL, 'Run daily at 2 AM', 'system'),
    ('trig-004', 'wf-003', 'Code Push Trigger', 'event', true, 'code.push', '{"branch":"main"}', 'Trigger on main branch push', 'system'),
    ('trig-005', 'wf-003', 'PR Created Trigger', 'event', true, 'code.pr.created', '{}', 'Trigger on pull request created', 'system'),
    ('trig-006', 'wf-004', 'Manual Onboarding', 'manual', true, NULL, NULL, 'Manual trigger for employee onboarding', 'system')
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 5. Insert sample workflow tasks for demonstration
-- ============================================================
INSERT INTO workflow_tasks (id, instance_id, node_id, task_type, assignee_type, assignee_id, title, description, status, priority, due_date, created_by)
VALUES
    ('task-001', 'inst-001', 'create-ticket', 'manual', 'user', 'admin', 'Review high priority ticket #1234', 'Please review and approve the new IT support ticket', 'pending', 'high', NOW() + INTERVAL '1 day', 'system'),
    ('task-002', 'inst-002', 'approval', 'manual', 'role', 'manager', 'Approve expense report #5678', 'Expense report for conference travel - $2,500', 'assigned', 'normal', NOW() + INTERVAL '2 days', 'system'),
    ('task-003', 'inst-003', 'hr-approval', 'manual', 'role', 'hr-manager', 'Onboarding approval for John Doe', 'New employee onboarding request', 'completed', 'high', NOW() - INTERVAL '1 day', 'system'),
    ('task-004', 'inst-004', 'setup-equipment', 'manual', 'user', 'it-staff', 'Prepare laptop for new hire', 'MacBook Pro 14" with 16GB RAM', 'pending', 'urgent', NOW() + INTERVAL '3 hours', 'system'),
    ('task-005', 'inst-005', 'check-services', 'manual', 'user', 'admin', 'Verify service health check results', 'Review the automated health check report', 'assigned', 'normal', NOW() + INTERVAL '4 hours', 'system')
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 6. Insert sample trigger logs
-- ============================================================
INSERT INTO workflow_trigger_logs (id, trigger_id, workflow_instance_id, event_type, status, execution_time_ms, triggered_at)
VALUES
    ('log-001', 'trig-001', 'inst-001', 'ticket.created', 'success', 1250, NOW() - INTERVAL '1 hour'),
    ('log-002', 'trig-002', 'inst-002', 'ticket.created', 'success', 980, NOW() - INTERVAL '2 hours'),
    ('log-003', 'trig-003', 'inst-003', NULL, 'success', 5420, NOW() - INTERVAL '12 hours'),
    ('log-004', 'trig-004', 'inst-004', 'code.push', 'success', 3250, NOW() - INTERVAL '1 day'),
    ('log-005', 'trig-005', 'inst-005', 'code.pr.created', 'failed', 8500, NOW() - INTERVAL '2 days')
ON CONFLICT (id) DO NOTHING;

-- Rollback (if needed):
-- DELETE FROM workflow_trigger_logs;
-- DELETE FROM workflow_tasks;
-- DELETE FROM workflow_triggers WHERE id IN ('trig-001','trig-002','trig-003','trig-004','trig-005','trig-006');
-- DELETE FROM lowcode_workflow_instance;
-- DELETE FROM lowcode_workflow_definition WHERE id IN ('wf-001','wf-002','wf-003','wf-004');
-- DROP TABLE IF EXISTS lowcode_workflow_instance;
-- DROP TABLE IF EXISTS lowcode_workflow_definition;