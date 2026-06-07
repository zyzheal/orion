-- Canary deployments table
CREATE TABLE IF NOT EXISTS canaries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    deployment_id VARCHAR(255) NOT NULL,
    service_name VARCHAR(255) NOT NULL,
    version VARCHAR(100) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    weight INT NOT NULL DEFAULT 10,
    target_weight INT NOT NULL DEFAULT 100,
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_canaries_tenant_id ON canaries(tenant_id);
CREATE INDEX IF NOT EXISTS idx_canaries_status ON canaries(status);
CREATE INDEX IF NOT EXISTS idx_canaries_service ON canaries(service_name);

-- Canary metrics (raw metric samples)
CREATE TABLE IF NOT EXISTS canary_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    canary_id UUID NOT NULL REFERENCES canaries(id) ON DELETE CASCADE,
    metric_name VARCHAR(255) NOT NULL,
    value DOUBLE PRECISION NOT NULL,
    source VARCHAR(100),
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_canary_metrics_canary_id ON canary_metrics(canary_id);

-- Canary analysis runs (ML analysis lifecycle)
CREATE TABLE IF NOT EXISTS canary_analysis_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    deployment_id VARCHAR(255) NOT NULL,
    run_number INT NOT NULL DEFAULT 1,
    traffic_split JSONB NOT NULL DEFAULT '{"canary": 10, "baseline": 90}',
    status VARCHAR(50) NOT NULL DEFAULT 'running',
    confidence DOUBLE PRECISION,
    decision VARCHAR(50),
    started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    duration_ms DOUBLE PRECISION
);

CREATE INDEX IF NOT EXISTS idx_canary_analysis_runs_deployment ON canary_analysis_runs(deployment_id);
CREATE INDEX IF NOT EXISTS idx_canary_analysis_runs_status ON canary_analysis_runs(status);

-- Canary metric results (statistical analysis per metric)
CREATE TABLE IF NOT EXISTS canary_metric_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id UUID NOT NULL REFERENCES canary_analysis_runs(id) ON DELETE CASCADE,
    metric_name VARCHAR(255) NOT NULL,
    baseline_value DOUBLE PRECISION,
    canary_value DOUBLE PRECISION,
    mann_whitney_p DOUBLE PRECISION,
    ks_statistic DOUBLE PRECISION,
    cliff_delta DOUBLE PRECISION,
    verdict VARCHAR(50),
    category VARCHAR(50)
);

CREATE INDEX IF NOT EXISTS idx_canary_metric_results_run ON canary_metric_results(run_id);

-- Canary ML results (ML model predictions)
CREATE TABLE IF NOT EXISTS canary_ml_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id UUID NOT NULL REFERENCES canary_analysis_runs(id) ON DELETE CASCADE,
    model_name VARCHAR(100) NOT NULL,
    prediction VARCHAR(50),
    confidence DOUBLE PRECISION,
    shap_explanation JSONB,
    cluster_id INT
);

CREATE INDEX IF NOT EXISTS idx_canary_ml_results_run ON canary_ml_results(run_id);

-- Canary analysis configs
CREATE TABLE IF NOT EXISTS canary_analysis_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    service_name VARCHAR(255) NOT NULL,
    environment VARCHAR(100) NOT NULL,
    analysis_interval_sec INT NOT NULL DEFAULT 300,
    max_rounds INT NOT NULL DEFAULT 5,
    warmup_period_sec INT NOT NULL DEFAULT 600,
    promote_threshold DOUBLE PRECISION NOT NULL DEFAULT 0.75,
    rollback_threshold DOUBLE PRECISION NOT NULL DEFAULT 0.60,
    traffic_step INT NOT NULL DEFAULT 20,
    metric_weights JSONB,
    excluded_metrics TEXT[] DEFAULT '{}',
    slo_metrics TEXT[] DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    UNIQUE(service_name, environment)
);

CREATE INDEX IF NOT EXISTS idx_canary_analysis_configs_service ON canary_analysis_configs(service_name, environment);

-- Canary decisions (decision audit trail)
CREATE TABLE IF NOT EXISTS canary_decisions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id UUID NOT NULL REFERENCES canary_analysis_runs(id) ON DELETE CASCADE,
    decision VARCHAR(50) NOT NULL,
    reason TEXT,
    overridden_by VARCHAR(100),
    override_reason TEXT,
    decided_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_canary_decisions_run ON canary_decisions(run_id);

-- Canary retrain jobs (ML model retraining tracking)
CREATE TABLE IF NOT EXISTS canary_retrain_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    model_name VARCHAR(100) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'queued',
    submitted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Canary traffic configs (traffic split configurations)
CREATE TABLE IF NOT EXISTS canary_traffic_configs (
    id VARCHAR(255) PRIMARY KEY,
    canary_id VARCHAR(255) NOT NULL,
    strategy VARCHAR(50) NOT NULL DEFAULT 'weighted',
    host VARCHAR(255),
    namespace VARCHAR(100) DEFAULT 'default',
    upstream_name VARCHAR(255),
    phase VARCHAR(50) DEFAULT 'initial',
    baseline_weight INT,
    canary_weight INT,
    baseline_destination VARCHAR(500),
    baseline_subset VARCHAR(100),
    canary_destination VARCHAR(500),
    canary_subset VARCHAR(100),
    servers JSONB DEFAULT '[]',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_canary_traffic_configs_canary ON canary_traffic_configs(canary_id);

-- Canary traffic history (execution audit trail)
CREATE TABLE IF NOT EXISTS canary_traffic_history (
    id VARCHAR(255) PRIMARY KEY,
    canary_id VARCHAR(255) NOT NULL,
    success BOOLEAN NOT NULL DEFAULT false,
    result TEXT NOT NULL,
    error TEXT,
    executed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_canary_traffic_history_canary ON canary_traffic_history(canary_id);

-- Canary analysis (simple analysis results tied to canary deployments)
CREATE TABLE IF NOT EXISTS canary_analysis (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    canary_id UUID NOT NULL REFERENCES canaries(id) ON DELETE CASCADE,
    score DOUBLE PRECISION NOT NULL DEFAULT 0,
    verdict VARCHAR(50) NOT NULL,
    details TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_canary_analysis_canary ON canary_analysis(canary_id);
