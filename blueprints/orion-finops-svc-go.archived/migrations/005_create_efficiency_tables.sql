-- Efficiency metrics: generic key-value metrics store
CREATE TABLE IF NOT EXISTS efficiency_metrics (
	id UUID PRIMARY KEY,
	tenant_id VARCHAR(64) NOT NULL,
	name VARCHAR(256) NOT NULL,
	metric_type VARCHAR(64) NOT NULL,
	value DOUBLE PRECISION NOT NULL,
	target DOUBLE PRECISION DEFAULT 0,
	unit VARCHAR(32),
	period VARCHAR(32),
	created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_efficiency_metrics_tenant ON efficiency_metrics(tenant_id, created_at);

-- Pipeline completion records (DORA input data)
CREATE TABLE IF NOT EXISTS efficiency_pipeline_records (
	id UUID PRIMARY KEY,
	tenant_id VARCHAR(64) NOT NULL,
	run_id VARCHAR(128) NOT NULL,
	pipeline_id VARCHAR(128) NOT NULL,
	status VARCHAR(32) NOT NULL,
	trigger_type VARCHAR(64),
	git_ref VARCHAR(256),
	git_sha VARCHAR(64),
	duration_ms BIGINT NOT NULL DEFAULT 0,
	completed_at TIMESTAMPTZ NOT NULL,
	synced_to_clickhouse BOOLEAN NOT NULL DEFAULT FALSE,
	synced_at TIMESTAMPTZ,
	created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_pipeline_records_tenant ON efficiency_pipeline_records(tenant_id, completed_at);

-- Deployment records (DORA input data)
CREATE TABLE IF NOT EXISTS efficiency_deployment_records (
	id UUID PRIMARY KEY,
	tenant_id VARCHAR(64) NOT NULL,
	deployment_id VARCHAR(128) NOT NULL,
	service VARCHAR(256),
	environment VARCHAR(64),
	status VARCHAR(32) NOT NULL,
	version VARCHAR(128),
	duration_ms BIGINT,
	deployed_at TIMESTAMPTZ NOT NULL,
	recovery_time_ms BIGINT,
	commit_sha VARCHAR(64),
	commit_committed_at TIMESTAMPTZ,
	synced_to_clickhouse BOOLEAN NOT NULL DEFAULT FALSE,
	synced_at TIMESTAMPTZ,
	created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_deployment_records_tenant ON efficiency_deployment_records(tenant_id, deployed_at);

-- Incident records (for MTTR calculation)
CREATE TABLE IF NOT EXISTS efficiency_incident_records (
	id UUID PRIMARY KEY,
	tenant_id VARCHAR(64) NOT NULL,
	deployment_id VARCHAR(128),
	pipeline_run_id VARCHAR(128),
	type VARCHAR(64) NOT NULL,
	severity VARCHAR(32),
	status VARCHAR(32) NOT NULL,
	detected_at TIMESTAMPTZ NOT NULL,
	acknowledged_at TIMESTAMPTZ,
	resolved_at TIMESTAMPTZ,
	recovery_time_ms BIGINT,
	service VARCHAR(256),
	environment VARCHAR(64),
	created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_incident_records_tenant ON efficiency_incident_records(tenant_id, detected_at);

-- Metric snapshots (for DORA trend calculation)
CREATE TABLE IF NOT EXISTS efficiency_metric_snapshots (
	id UUID PRIMARY KEY,
	tenant_id VARCHAR(64) NOT NULL,
	time_window VARCHAR(32) NOT NULL,
	deployment_frequency DOUBLE PRECISION NOT NULL DEFAULT 0,
	lead_time_ms DOUBLE PRECISION NOT NULL DEFAULT 0,
	change_failure_rate DOUBLE PRECISION NOT NULL DEFAULT 0,
	mttr_ms DOUBLE PRECISION NOT NULL DEFAULT 0,
	captured_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_metric_snapshots_tenant ON efficiency_metric_snapshots(tenant_id, captured_at);

-- Dashboard scenario cache
CREATE TABLE IF NOT EXISTS efficiency_scenarios (
	id UUID PRIMARY KEY,
	tenant_id VARCHAR(64) NOT NULL,
	scenario_id VARCHAR(64) NOT NULL,
	name VARCHAR(256) NOT NULL,
	description TEXT,
	category VARCHAR(64),
	widgets JSONB,
	time_range JSONB,
	summary JSONB,
	cache_key VARCHAR(512) NOT NULL,
	expires_at TIMESTAMPTZ,
	created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_scenarios_cache_key ON efficiency_scenarios(cache_key);
CREATE INDEX IF NOT EXISTS idx_scenarios_tenant ON efficiency_scenarios(tenant_id, scenario_id);

-- Weekly reports
CREATE TABLE IF NOT EXISTS weekly_reports (
	id VARCHAR(128) PRIMARY KEY,
	team_id VARCHAR(64) NOT NULL,
	week_start DATE NOT NULL,
	week_end DATE NOT NULL,
	report_data JSONB,
	created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_weekly_reports_team ON weekly_reports(team_id, week_start);

-- Team data (for EfficiencyReportService)
CREATE TABLE IF NOT EXISTS efficiency_team_data (
	id VARCHAR(128) PRIMARY KEY,
	tenant_id VARCHAR(64) NOT NULL,
	name VARCHAR(256) NOT NULL,
	members INT NOT NULL DEFAULT 0,
	pipelines JSONB,
	deployments JSONB,
	created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_team_data_tenant ON efficiency_team_data(tenant_id);

-- Project data (for EfficiencyReportService)
CREATE TABLE IF NOT EXISTS efficiency_project_data (
	id VARCHAR(128) PRIMARY KEY,
	tenant_id VARCHAR(64) NOT NULL,
	name VARCHAR(256) NOT NULL,
	pipelines JSONB,
	deployments JSONB,
	commits INT NOT NULL DEFAULT 0,
	created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_project_data_tenant ON efficiency_project_data(tenant_id);

-- Global deployments (for EfficiencyReportService)
CREATE TABLE IF NOT EXISTS efficiency_global_deployments (
	id UUID PRIMARY KEY,
	tenant_id VARCHAR(64) NOT NULL,
	deployment_data JSONB NOT NULL,
	deployed_at TIMESTAMPTZ NOT NULL,
	created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_global_deployments_tenant ON efficiency_global_deployments(tenant_id, deployed_at);

-- Global pipeline records (for EfficiencyReportService)
CREATE TABLE IF NOT EXISTS efficiency_global_pipelines (
	id UUID PRIMARY KEY,
	tenant_id VARCHAR(64) NOT NULL,
	pipeline_data JSONB NOT NULL,
	completed_at TIMESTAMPTZ NOT NULL,
	created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_global_pipelines_tenant ON efficiency_global_pipelines(tenant_id, completed_at);

-- Report history
CREATE TABLE IF NOT EXISTS efficiency_report_history (
	id UUID PRIMARY KEY,
	tenant_id VARCHAR(64) NOT NULL,
	report_data JSONB NOT NULL,
	generated_at TIMESTAMPTZ NOT NULL,
	created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_report_history_tenant ON efficiency_report_history(tenant_id, generated_at);
