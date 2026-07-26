CREATE TABLE IF NOT EXISTS inspection_rules (
	id UUID PRIMARY KEY,
	tenant_id VARCHAR(64) NOT NULL,
	name VARCHAR(256) NOT NULL,
	description TEXT,
	rule_type VARCHAR(64) NOT NULL,
	target VARCHAR(256) NOT NULL,
	condition JSONB NOT NULL DEFAULT '{}',
	severity VARCHAR(16) NOT NULL DEFAULT 'medium',
	enabled BOOLEAN NOT NULL DEFAULT true,
	schedule VARCHAR(64),
	created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_inspection_rules_tenant ON inspection_rules(tenant_id, created_at);

CREATE TABLE IF NOT EXISTS inspection_results (
	id UUID PRIMARY KEY,
	tenant_id VARCHAR(64) NOT NULL,
	rule_id VARCHAR(128) NOT NULL,
	rule_name VARCHAR(256) NOT NULL,
	status VARCHAR(32) NOT NULL DEFAULT 'pending',
	target VARCHAR(256) NOT NULL,
	details JSONB DEFAULT '{}',
	remediation TEXT,
	executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_inspection_results_tenant ON inspection_results(tenant_id, executed_at);
CREATE INDEX idx_inspection_results_rule ON inspection_results(tenant_id, rule_id);

CREATE TABLE IF NOT EXISTS inspection_tasks (
	id UUID PRIMARY KEY,
	tenant_id VARCHAR(64) NOT NULL,
	rule_id VARCHAR(128) NOT NULL,
	status VARCHAR(32) NOT NULL DEFAULT 'pending',
	result_id UUID,
	started_at TIMESTAMPTZ,
	completed_at TIMESTAMPTZ,
	created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_inspection_tasks_tenant ON inspection_tasks(tenant_id, created_at);
CREATE INDEX idx_inspection_tasks_rule ON inspection_tasks(rule_id);
CREATE INDEX idx_inspection_tasks_status ON inspection_tasks(status);

CREATE TABLE IF NOT EXISTS inspection_reports (
	id UUID PRIMARY KEY,
	tenant_id VARCHAR(64) NOT NULL,
	title VARCHAR(256) NOT NULL,
	summary JSONB NOT NULL DEFAULT '{"total":0,"passed":0,"failed":0,"warning":0,"score":0}',
	generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_inspection_reports_tenant ON inspection_reports(tenant_id, generated_at);
