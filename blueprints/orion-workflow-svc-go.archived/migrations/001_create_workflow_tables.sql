CREATE TABLE IF NOT EXISTS workflows (
	id UUID PRIMARY KEY,
	tenant_id VARCHAR(64) NOT NULL,
	name VARCHAR(256) NOT NULL,
	description TEXT NOT NULL DEFAULT '',
	steps JSONB NOT NULL DEFAULT '[]',
	status VARCHAR(32) NOT NULL DEFAULT 'active',
	created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_workflows_tenant ON workflows(tenant_id);

CREATE TABLE IF NOT EXISTS workflow_runs (
	id UUID PRIMARY KEY,
	workflow_id UUID NOT NULL,
	tenant_id VARCHAR(64) NOT NULL,
	status VARCHAR(32) NOT NULL DEFAULT 'pending',
	input JSONB NOT NULL DEFAULT '{}',
	output JSONB NOT NULL DEFAULT '{}',
	started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	completed_at TIMESTAMPTZ
);
CREATE INDEX idx_workflow_runs_wf ON workflow_runs(workflow_id, started_at);
