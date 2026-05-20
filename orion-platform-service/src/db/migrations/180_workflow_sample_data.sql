-- Migration 180: Workflow Sample Data
--
-- Inserts sample workflow definitions and triggers for demonstration
-- This enables the frontend pages to display real data

-- ============================================================
-- 1. Create workflow definition table if not exists
-- ============================================================
CREATE TABLE IF NOT EXISTS lowcode_workflow_definition (
    id                  VARCHAR(100) PRIMARY KEY,
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
    id                  VARCHAR(100) PRIMARY KEY,
    workflow_id         VARCHAR(100) NOT NULL,
    workflow_definition_id VARCHAR(100) NOT NULL,
    tenant_id           VARCHAR(100) DEFAULT 'default',
    status              VARCHAR(20) NOT NULL DEFAULT 'pending',
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
     '[{"id":"start-1","type":"start","name":"开始","position":{"x":20,"y":100},"config":{}},{"id":"task-1","type":"task","name":"创建工单","position":{"x":250,"y":100},"config":{"title":"Create Support Ticket","description":"Create a new support ticket","assigneeType":"user","assigneeIds":["admin"]}},{"id":"approval-1","type":"approval","name":"审批","position":{"x":480,"y":100},"config":{"approverType":"role","approverIds":["manager"],"timeout":24,"timeoutAction":"approve"}},{"id":"notification-1","type":"notification","name":"通知","position":{"x":710,"y":100},"config":{"channels":["email"],"template":"Your ticket has been approved"}},{"id":"end-1","type":"end","name":"结束","position":{"x":940,"y":100},"config":{}}]',
     '[{"id":"e1","source":"start-1","target":"task-1"},{"id":"e2","source":"task-1","target":"approval-1"},{"id":"e3","source":"approval-1","target":"notification-1"},{"id":"e4","source":"notification-1","target":"end-1"}]',
     'system'),

    ('wf-002', 'default', 'Daily Health Check', 'Automated daily system health check workflow', 1, true,
     '[{"id":"start-2","type":"start","name":"开始","position":{"x":20,"y":100},"config":{}},{"id":"task-2a","type":"task","name":"检查服务","position":{"x":250,"y":80},"config":{"title":"Check Service Health","taskType":"system"}},{"id":"delay-1","type":"delay","name":"等待5分钟","position":{"x":480,"y":100},"config":{"duration":300}},{"id":"task-2b","type":"task","name":"检查数据库","position":{"x":710,"y":80},"config":{"title":"Check Database Connection","taskType":"system"}},{"id":"end-2","type":"end","name":"结束","position":{"x":940,"y":100},"config":{}}]',
     '[{"id":"e5","source":"start-2","target":"task-2a"},{"id":"e6","source":"task-2a","target":"delay-1"},{"id":"e7","source":"delay-1","target":"task-2b"},{"id":"e8","source":"task-2b","target":"end-2"}]',
     'system'),

    ('wf-003', 'default', 'CI/CD Pipeline Trigger', 'Triggered by code push events to start CI pipeline', 1, true,
     '[{"id":"start-3","type":"start","name":"开始","position":{"x":20,"y":100},"config":{}},{"id":"webhook-1","type":"webhook","name":"构建","position":{"x":250,"y":60},"config":{"url":"https://ci.example.com/build","method":"POST","timeout":30000}},{"id":"webhook-2","type":"webhook","name":"测试","position":{"x":480,"y":100},"config":{"url":"https://ci.example.com/test","method":"POST","timeout":60000}},{"id":"webhook-3","type":"webhook","name":"部署","position":{"x":710,"y":140},"config":{"url":"https://ci.example.com/deploy","method":"POST","timeout":120000}},{"id":"end-3","type":"end","name":"结束","position":{"x":940,"y":100},"config":{}}]',
     '[{"id":"e9","source":"start-3","target":"webhook-1"},{"id":"e10","source":"webhook-1","target":"webhook-2"},{"id":"e11","source":"webhook-2","target":"webhook-3"},{"id":"e12","source":"webhook-3","target":"end-3"}]',
     'system'),

    ('wf-004', 'default', 'Employee Onboarding', 'New employee onboarding workflow with multiple approvals', 1, false,
     '[{"id":"start-4","type":"start","name":"开始","position":{"x":20,"y":120},"config":{}},{"id":"task-4a","type":"task","name":"创建账号","position":{"x":250,"y":120},"config":{"title":"Create employee account"}},{"id":"approval-4a","type":"approval","name":"HR审批","position":{"x":480,"y":60},"config":{"approverType":"role","approverIds":["hr-manager"]}},{"id":"approval-4b","type":"approval","name":"IT审批","position":{"x":480,"y":180},"config":{"approverType":"role","approverIds":["it-manager"]}},{"id":"task-4b","type":"task","name":"配置设备","position":{"x":710,"y":120},"config":{"title":"Prepare laptop and equipment"}},{"id":"end-4","type":"end","name":"结束","position":{"x":940,"y":120},"config":{}}]',
     '[{"id":"e13","source":"start-4","target":"task-4a"},{"id":"e14","source":"task-4a","target":"approval-4a"},{"id":"e15","source":"task-4a","target":"approval-4b"},{"id":"e16","source":"approval-4a","target":"task-4b"},{"id":"e17","source":"approval-4b","target":"task-4b"},{"id":"e18","source":"task-4b","target":"end-4"}]',
     'system')
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 4. Insert sample workflow triggers
-- ============================================================
INSERT INTO workflow_triggers (id, workflow_id, name, type, enabled, event_type, event_filter, description, created_by)
VALUES
    ('550e8400-e29b-41d4-a716-446655440001', 'wf-001', 'Ticket Created Trigger', 'event', true, 'ticket.created', '{"priority":"high"}', 'Trigger when high priority ticket is created', 'system'),
    ('550e8400-e29b-41d4-a716-446655440002', 'wf-001', 'Ticket Auto Assign', 'event', true, 'ticket.created', '{}', 'Trigger when any ticket is created', 'system'),
    ('550e8400-e29b-41d4-a716-446655440003', 'wf-002', 'Daily Health Check', 'cron', true, NULL, NULL, 'Run daily at 2 AM', 'system'),
    ('550e8400-e29b-41d4-a716-446655440004', 'wf-003', 'Code Push Trigger', 'event', true, 'code.push', '{"branch":"main"}', 'Trigger on main branch push', 'system'),
    ('550e8400-e29b-41d4-a716-446655440005', 'wf-003', 'PR Created Trigger', 'event', true, 'code.pr.created', '{}', 'Trigger on pull request created', 'system'),
    ('550e8400-e29b-41d4-a716-446655440006', 'wf-004', 'Manual Onboarding', 'manual', true, NULL, NULL, 'Manual trigger for employee onboarding', 'system')
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 5. Insert sample workflow tasks for demonstration
-- ============================================================
INSERT INTO workflow_tasks (id, instance_id, node_id, task_type, assignee_type, assignee_id, title, description, status, priority, due_date)
VALUES
    ('660e8400-e29b-41d4-a716-446655440001', 'inst-wf001-1', 'create-ticket', 'manual', 'user', 'admin', 'Review high priority ticket #1234', 'Please review and approve the new IT support ticket', 'pending', 'high', NOW() + INTERVAL '1 day'),
    ('660e8400-e29b-41d4-a716-446655440002', 'inst-wf001-2', 'approval', 'manual', 'role', 'manager', 'Approve expense report #5678', 'Expense report for conference travel - $2,500', 'assigned', 'normal', NOW() + INTERVAL '2 days'),
    ('660e8400-e29b-41d4-a716-446655440003', 'inst-wf002-1', 'hr-approval', 'manual', 'role', 'hr-manager', 'Onboarding approval for John Doe', 'New employee onboarding request', 'completed', 'high', NOW() - INTERVAL '1 day'),
    ('660e8400-e29b-41d4-a716-446655440004', 'inst-wf003-1', 'setup-equipment', 'manual', 'user', 'it-staff', 'Prepare laptop for new hire', 'MacBook Pro 14" with 16GB RAM', 'pending', 'urgent', NOW() + INTERVAL '3 hours'),
    ('660e8400-e29b-41d4-a716-446655440005', 'inst-wf004-1', 'check-services', 'manual', 'user', 'admin', 'Verify service health check results', 'Review the automated health check report', 'assigned', 'normal', NOW() + INTERVAL '4 hours')
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 6. Insert sample workflow instances (execution records)
-- ============================================================
INSERT INTO lowcode_workflow_instance (id, workflow_id, workflow_definition_id, tenant_id, status, current_node_id, variables, history, input, output, created_at, updated_at, completed_at)
VALUES
    ('inst-wf001-1', 'wf-001', 'wf-001', 'default', 'completed', 'end-1', '{}', '[{"nodeId":"start-1","nodeName":"开始","nodeType":"start","action":"enter","timestamp":"2025-05-18T10:00:00Z"},{"nodeId":"start-1","nodeName":"开始","nodeType":"start","action":"exit","timestamp":"2025-05-18T10:00:01Z"},{"nodeId":"task-1","nodeName":"创建工单","nodeType":"task","action":"enter","timestamp":"2025-05-18T10:00:02Z","data":{"ticketId":"T-1234"}},{"nodeId":"task-1","nodeName":"创建工单","nodeType":"task","action":"exit","timestamp":"2025-05-18T10:00:05Z"},{"nodeId":"approval-1","nodeName":"审批","nodeType":"approval","action":"enter","timestamp":"2025-05-18T10:00:06Z"},{"nodeId":"approval-1","nodeName":"审批","nodeType":"approval","action":"exit","timestamp":"2025-05-18T10:05:00Z","data":{"approved":true}},{"nodeId":"notification-1","nodeName":"通知","nodeType":"notification","action":"enter","timestamp":"2025-05-18T10:05:01Z"},{"nodeId":"notification-1","nodeName":"通知","nodeType":"notification","action":"exit","timestamp":"2025-05-18T10:05:03Z"},{"nodeId":"end-1","nodeName":"结束","nodeType":"end","action":"enter","timestamp":"2025-05-18T10:05:04Z"}]', '{"requester":"john.doe","priority":"high"}', '{"ticketId":"T-1234","status":"created","approved":true}', '2025-05-18T10:00:00Z', '2025-05-18T10:05:04Z', '2025-05-18T10:05:04Z'),

    ('inst-wf001-2', 'wf-001', 'wf-001', 'default', 'running', 'approval-1', '{}', '[{"nodeId":"start-1","nodeName":"开始","nodeType":"start","action":"enter","timestamp":"2025-05-19T14:30:00Z"},{"nodeId":"start-1","nodeName":"开始","nodeType":"start","action":"exit","timestamp":"2025-05-19T14:30:01Z"},{"nodeId":"task-1","nodeName":"创建工单","nodeType":"task","action":"enter","timestamp":"2025-05-19T14:30:02Z","data":{"ticketId":"T-1235"}}]', '{"requester":"jane.smith","priority":"urgent"}', NULL, '2025-05-19T14:30:00Z', '2025-05-19T14:30:10Z', NULL),

    ('inst-wf002-1', 'wf-002', 'wf-002', 'default', 'completed', 'end-2', '{}', '[{"nodeId":"start-2","nodeName":"开始","nodeType":"start","action":"enter","timestamp":"2025-05-18T02:00:00Z"},{"nodeId":"task-2a","nodeName":"检查服务","nodeType":"task","action":"enter","timestamp":"2025-05-18T02:00:01Z","data":{"services":[{"name":"API","status":"healthy"},{"name":"DB","status":"healthy"}]}},{"nodeId":"task-2a","nodeName":"检查服务","nodeType":"task","action":"exit","timestamp":"2025-05-18T02:00:05Z"}]', '{}', '{"servicesChecked":5,"allHealthy":true}', '2025-05-18T02:00:00Z', '2025-05-18T02:00:30Z', '2025-05-18T02:00:30Z'),

    ('inst-wf003-1', 'wf-003', 'wf-003', 'default', 'failed', 'webhook-2', '{}', '[{"nodeId":"start-3","nodeName":"开始","nodeType":"start","action":"enter","timestamp":"2025-05-17T09:15:00Z"},{"nodeId":"webhook-1","nodeName":"构建","nodeType":"webhook","action":"enter","timestamp":"2025-05-17T09:15:01Z"},{"nodeId":"webhook-1","nodeName":"构建","nodeType":"webhook","action":"exit","timestamp":"2025-05-17T09:15:15Z","data":{"buildId":"build-abc"}},{"nodeId":"webhook-2","nodeName":"测试","nodeType":"webhook","action":"enter","timestamp":"2025-05-17T09:15:16Z"},{"nodeId":"webhook-2","nodeName":"测试","nodeType":"webhook","action":"error","timestamp":"2025-05-17T09:20:00Z","error":"Test suite failed: 3 tests failed, 12 passed"}]', '{"branch":"main","commit":"abc123"}', NULL, '2025-05-17T09:15:00Z', '2025-05-17T09:20:00Z', '2025-05-17T09:20:00Z'),

    ('inst-wf004-1', 'wf-004', 'wf-004', 'default', 'suspended', 'task-4b', '{}', '[{"nodeId":"start-4","nodeName":"开始","nodeType":"start","action":"enter","timestamp":"2025-05-16T11:00:00Z"},{"nodeId":"task-4a","nodeName":"创建账号","nodeType":"task","action":"enter","timestamp":"2025-05-16T11:00:01Z","data":{"accountId":"EMP-2025-001"}},{"nodeId":"task-4a","nodeName":"创建账号","nodeType":"task","action":"exit","timestamp":"2025-05-16T11:00:05Z"},{"nodeId":"approval-4a","nodeName":"HR审批","nodeType":"approval","action":"enter","timestamp":"2025-05-16T11:00:06Z"}]', '{"employeeName":"张三","department":"Engineering","startDate":"2025-06-01"}', NULL, '2025-05-16T11:00:00Z', '2025-05-16T11:00:10Z', NULL)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 7. Insert sample trigger logs
-- ============================================================
INSERT INTO workflow_trigger_logs (id, trigger_id, workflow_instance_id, event_type, status, execution_time_ms, triggered_at)
VALUES
    ('770e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440001', 'inst-wf001-1', 'ticket.created', 'success', 1250, NOW() - INTERVAL '1 hour'),
    ('770e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440002', 'inst-wf001-2', 'ticket.created', 'success', 980, NOW() - INTERVAL '2 hours'),
    ('770e8400-e29b-41d4-a716-446655440003', '550e8400-e29b-41d4-a716-446655440003', 'inst-wf002-1', NULL, 'success', 5420, NOW() - INTERVAL '12 hours'),
    ('770e8400-e29b-41d4-a716-446655440004', '550e8400-e29b-41d4-a716-446655440004', 'inst-wf003-1', 'code.push', 'success', 3250, NOW() - INTERVAL '1 day'),
    ('770e8400-e29b-41d4-a716-446655440005', '550e8400-e29b-41d4-a716-446655440005', 'inst-wf003-1', 'code.pr.created', 'failed', 8500, NOW() - INTERVAL '2 days')
ON CONFLICT (id) DO NOTHING;

-- Rollback (if needed):
-- DELETE FROM workflow_trigger_logs WHERE id LIKE '770e8400-%';
-- DELETE FROM workflow_tasks WHERE id LIKE '660e8400-%';
-- DELETE FROM workflow_triggers WHERE id LIKE '550e8400-%';
-- DELETE FROM lowcode_workflow_instance WHERE id LIKE 'inst-%';
-- DELETE FROM lowcode_workflow_definition WHERE id IN ('wf-001','wf-002','wf-003','wf-004');
-- DROP TABLE IF EXISTS lowcode_workflow_instance;
-- DROP TABLE IF EXISTS lowcode_workflow_definition;
