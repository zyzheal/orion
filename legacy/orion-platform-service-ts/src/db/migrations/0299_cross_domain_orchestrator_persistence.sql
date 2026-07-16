-- Migration 0299: Cross-Domain Orchestrator persistence verification
-- Tables already exist from migration 165. This migration ensures indexes are present.

CREATE INDEX IF NOT EXISTS idx_cross_domain_workflows_status ON cross_domain_workflows(status);
CREATE INDEX IF NOT EXISTS idx_cross_domain_workflows_tenant ON cross_domain_workflows(tenant_id);
CREATE INDEX IF NOT EXISTS idx_cross_domain_workflow_steps_workflow ON cross_domain_workflow_steps(workflow_id);
CREATE INDEX IF NOT EXISTS idx_cross_domain_executions_workflow ON cross_domain_executions(workflow_id);
CREATE INDEX IF NOT EXISTS idx_cross_domain_executions_status ON cross_domain_executions(status);
CREATE INDEX IF NOT EXISTS idx_cross_domain_execution_steps_exec ON cross_domain_execution_steps(execution_id);
