-- Migration 029: ML Canary Analysis
-- Creates tables for canary analysis runs, metric results, ML results, configs, and decisions

-- 金丝雀分析运行
CREATE TABLE IF NOT EXISTS canary_analysis_runs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deployment_id   UUID NOT NULL,
  run_number      INT NOT NULL,
  traffic_split   JSONB NOT NULL,              -- {canary: 10, baseline: 90}
  status          VARCHAR(20) NOT NULL,         -- running | promote | rollback | inconclusive
  confidence      DECIMAL(3,3),                 -- 0.000 - 1.000
  decision        VARCHAR(20),                  -- promote | rollback | continue
  started_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at    TIMESTAMPTZ,
  duration_ms     INT
);
CREATE INDEX idx_canary_runs_deployment ON canary_analysis_runs(deployment_id);
CREATE INDEX idx_canary_runs_status ON canary_analysis_runs(status);

-- 指标结果
CREATE TABLE IF NOT EXISTS canary_metric_results (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id          UUID REFERENCES canary_analysis_runs(id) ON DELETE CASCADE,
  metric_name     VARCHAR(100) NOT NULL,
  baseline_value  DECIMAL(15,6),
  canary_value    DECIMAL(15,6),
  mann_whitney_p  DECIMAL(5,4),
  ks_statistic    DECIMAL(5,4),
  cliff_delta     DECIMAL(5,4),
  verdict         VARCHAR(20),                  -- pass | warn | fail
  category        VARCHAR(50)                   -- latency | error_rate | throughput | saturation
);
CREATE INDEX idx_canary_metrics_run ON canary_metric_results(run_id);
CREATE INDEX idx_canary_metrics_category ON canary_metric_results(category);

-- ML 结果
CREATE TABLE IF NOT EXISTS canary_ml_results (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id          UUID REFERENCES canary_analysis_runs(id) ON DELETE CASCADE,
  model_name      VARCHAR(50) NOT NULL,          -- xgboost | dbscan
  prediction      VARCHAR(20),                   -- healthy | degraded
  confidence      DECIMAL(3,3),
  shap_explanation JSONB,                        -- Feature contributions
  cluster_id      INT                            -- DBSCAN cluster assignment
);
CREATE INDEX idx_canary_ml_run ON canary_ml_results(run_id);

-- 分析配置
CREATE TABLE IF NOT EXISTS canary_analysis_configs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_name    VARCHAR(100) NOT NULL,
  environment     VARCHAR(50) NOT NULL,
  analysis_interval_sec INT DEFAULT 300,         -- 5min default
  max_rounds      INT DEFAULT 5,
  warmup_period_sec INT DEFAULT 600,             -- 10min warmup
  promote_threshold DECIMAL(3,3) DEFAULT 0.75,
  rollback_threshold DECIMAL(3,3) DEFAULT 0.60,
  traffic_step    INT DEFAULT 20,                -- 20% per step
  metric_weights  JSONB,                         -- Category weights
  excluded_metrics TEXT[],                       -- Metrics to skip
  slo_metrics     TEXT[],                        -- SLO-critical metrics
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX idx_canary_configs_service_env ON canary_analysis_configs(service_name, environment);

-- 决策历史
CREATE TABLE IF NOT EXISTS canary_decisions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id          UUID REFERENCES canary_analysis_runs(id),
  decision        VARCHAR(20) NOT NULL,
  reason          TEXT,
  overridden_by   UUID,                          -- If manually overridden
  override_reason TEXT,
  decided_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_canary_decisions_run ON canary_decisions(run_id);
CREATE INDEX idx_canary_decisions_decision ON canary_decisions(decision);
